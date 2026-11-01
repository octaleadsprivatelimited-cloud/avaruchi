import { type PrismaClient, type ProviderKind, type Prisma } from "@prisma/client";
import type { AppConfig } from "./config.js";
import {
  renderEmailNotification,
} from "./notification-content.js";
import { SecretVault } from "./security.js";
import { EmailConfigurationError, prepareResendEmail, readPreparedEmailDelivery, sendResendEmail, type EmailAttachment, type PreparedEmailDelivery } from "./resend-email.js";
import { renderLegacyOrderEmail } from "./legacy-order-email.js";
import { generateInvoicePdf, invoiceInputFromNotificationPayload } from "./invoice.js";

class DeliveryNotConfigured extends EmailConfigurationError {}
class DeliveryWindowExpired extends Error {}
export async function processNotificationBatch({ db, config, request = fetch }: { db: PrismaClient; config: AppConfig; request?: typeof fetch }) {
const vault = new SecretVault(config.INTEGRATION_ENCRYPTION_KEY);
const environment = config.NODE_ENV === "production" ? "LIVE" : "TEST";
const maxAttempts = 5;
const publicRecord = (value: unknown) =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};

async function configuredIntegration(kind: ProviderKind, provider: string) {
  const integration = await db.integrationConfig.findFirst({
    where: {
      kind,
      provider: { equals: provider },
      enabled: true,
      environment,
    },
    orderBy: [{ priority: "asc" }, { updatedAt: "desc" }, { id: "asc" }],
  });
  if (!integration)
    throw new DeliveryNotConfigured(
      `No enabled ${provider} ${kind.toLowerCase()} integration is configured`,
    );
  return {
    credentials: vault.decrypt<Record<string, string>>(
      Buffer.from(integration.encryptedCredentials).toString("base64"),
    ),
    publicConfig: publicRecord(integration.publicConfig),
  };
}

async function sendEmail(notification: {
  id: string;
  template: string;
  destination: string;
  payload: unknown;
  firstAttemptAt?: Date | null;
}) {
  const { credentials, publicConfig } = await configuredIntegration(
      "EMAIL",
      "resend",
    );
  const payload = publicRecord(notification.payload);
  const firstAttemptAt = notification.firstAttemptAt || new Date();
  if (Date.now() - firstAttemptAt.getTime() >= 23 * 60 * 60_000) throw new DeliveryWindowExpired("Automatic delivery stopped after the safe idempotency window; verify provider delivery before retrying manually");
  let delivery: PreparedEmailDelivery;
  if (payload._emailDelivery !== undefined) {
    const frozen = publicRecord(payload._emailDelivery);
    if (frozen.version !== 1 || frozen.template !== notification.template || typeof frozen.body !== "string" || frozen.body.length > 18 * 1024 * 1024 || !notification.firstAttemptAt)
      throw new DeliveryNotConfigured("Stored email delivery snapshot requires review before retrying");
    let body: unknown;
    try { body = JSON.parse(frozen.body); }
    catch { throw new DeliveryNotConfigured("Stored email delivery snapshot requires review before retrying"); }
    delivery = readPreparedEmailDelivery(body, notification.destination);
  } else {
    // Pre-release uncertain sends must retain the exact pre-invoice template.
    // An already-attempted invoice without a frozen body cannot safely be recreated.
    if (notification.firstAttemptAt && payload.invoice)
      throw new DeliveryNotConfigured("Stored invoice delivery snapshot is missing; verify provider delivery before retrying manually");
    const legacy = Boolean(notification.firstAttemptAt);
    let attachments: EmailAttachment[] | undefined;
    if (!legacy && notification.template === "order.confirmed") {
      const invoice = invoiceInputFromNotificationPayload(payload);
      if (invoice) {
        const pdf = await generateInvoicePdf(invoice);
        const number = invoice.order.number.replace(/[^A-Za-z0-9_-]/g, "").slice(0, 80) || "order";
        attachments = [{ filename: `invoice-${number}.pdf`, content: pdf.toString("base64"), content_type: "application/pdf" }];
      }
    }
    const content = legacy
      ? renderLegacyOrderEmail(notification.template as "order.confirmed" | "order.received", payload)
      : { ...renderEmailNotification(notification.template, payload, { invoiceAttached: Boolean(attachments?.length) }), ...(attachments ? { attachments } : {}) };
    delivery = prepareResendEmail({ publicConfig, destination: notification.destination, content });
    // Keep the provider JSON as a string: MySQL JSON objects may reorder keys.
    // This atomic write happens before POST, including for pre-release retries.
    const frozen = { version: 1, template: notification.template, body: JSON.stringify(delivery) };
    await db.notification.update({ where: { id: notification.id }, data: {
      firstAttemptAt, payload: JSON.parse(JSON.stringify({ ...payload, _emailDelivery: frozen })) as Prisma.InputJsonValue,
    } });
  }
  return sendResendEmail({ credentials, publicConfig, destination: notification.destination, content: delivery, delivery, idempotencyKey: notification.id, request });
}

  const batch = await db.$transaction(async (tx) => {
    await tx.notification.updateMany({
      where: {
        status: "PROCESSING",
        channel: "EMAIL",
        template: { in: ["order.confirmed", "order.received"] },
        lockedAt: { lt: new Date(Date.now() - 15 * 60_000) },
      },
      data: { status: "QUEUED", lockedAt: null },
    });
    const due = await tx.$queryRaw<Array<{ id: string }>>`
      SELECT \`id\` FROM \`Notification\`
      WHERE \`status\` = 'QUEUED'
        AND \`channel\` = 'EMAIL'
        AND \`template\` IN ('order.confirmed', 'order.received')
        AND \`nextAttemptAt\` <= NOW()
      ORDER BY \`createdAt\` ASC
      LIMIT 50
      FOR UPDATE SKIP LOCKED
    `;
    if (!due.length) return [];
    const ids = due.map(({ id }) => id);
    await tx.notification.updateMany({
      where: { id: { in: ids }, status: "QUEUED" },
      data: { status: "PROCESSING", lockedAt: new Date() },
    });
    return tx.notification.findMany({ where: { id: { in: ids } } });
  });
  let sent = 0,
    retried = 0,
    failed = 0, deferred = 0;
  for (const notification of batch) {
    try {
      const providerMessageId = await sendEmail(notification);
      await db.notification.update({
        where: { id: notification.id },
        data: {
          status: "SENT",
          sentAt: new Date(),
          providerMessageId,
          error: null,
          lockedAt: null,
        },
      });
      sent += 1;
    } catch (error) {
      const unconfigured = error instanceof EmailConfigurationError;
      const attempts = notification.attempts + (unconfigured ? 0 : 1),
        exhausted = error instanceof DeliveryWindowExpired || (!unconfigured && attempts >= maxAttempts),
        delayMinutes = unconfigured ? 5 : Math.min(60, 2 ** attempts);
      await db.notification.update({
        where: { id: notification.id },
        data: {
          status: exhausted ? "FAILED" : "QUEUED",
          attempts,
          nextAttemptAt: new Date(Date.now() + delayMinutes * 60_000),
          lockedAt: null,
          error:
            error instanceof Error
              ? error.message.slice(0, 500)
              : "Delivery failed",
        },
      });
      unconfigured ? (deferred += 1) : exhausted ? (failed += 1) : (retried += 1);
    }
  }
  return { processed: batch.length, sent, retried, failed, deferred };
}

export function startNotificationWorker(options: { db: PrismaClient; config: AppConfig; request?: typeof fetch; intervalMs?: number }) {
  let stopped = false;
  let active: Promise<unknown> = Promise.resolve();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const run = () => {
    if (stopped) return;
    active = processNotificationBatch(options).then(result => {
      if (result.processed) console.log(JSON.stringify({ worker: "notifications", ...result }));
    }).catch(() => { console.error("Notification worker failed; queued messages will be retried."); }).finally(() => {
      if (!stopped) { timer = setTimeout(run, options.intervalMs || 30_000); timer.unref(); }
    });
  };
  run();
  return async () => { stopped = true; if (timer) clearTimeout(timer); await active; };
}
