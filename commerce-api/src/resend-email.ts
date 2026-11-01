export type EmailAttachment = { filename: string; content: string; content_type: "application/pdf" };
export type EmailContent = { subject: string; html: string; text: string; attachments?: EmailAttachment[] };
export type PreparedEmailDelivery = EmailContent & { from: string; to: string; reply_to?: string };
export class EmailConfigurationError extends Error {}
const validEmail = (value: string) => value.length <= 254 && /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(value);
const validAttachments = (attachments: EmailAttachment[] | undefined) => {
  if (!attachments) return;
  if (!Array.isArray(attachments) || attachments.length > 1) throw new Error("An order email supports one invoice attachment");
  for (const attachment of attachments) {
    if (!attachment || typeof attachment !== "object" || Object.keys(attachment).some(key => !["filename", "content", "content_type"].includes(key)) ||
      attachment.content_type !== "application/pdf" || !/^[A-Za-z0-9][A-Za-z0-9._-]{0,119}\.pdf$/.test(attachment.filename) ||
      typeof attachment.content !== "string" || attachment.content.length > 12 * 1024 * 1024 ||
      (attachment.content.length % 4 !== 0 || /[^A-Za-z0-9+/=]/.test(attachment.content)))
      throw new Error("Invoice attachment is invalid");
    const pdf = Buffer.from(attachment.content, "base64");
    if (pdf.length > 8 * 1024 * 1024 || pdf.toString("base64") !== attachment.content || pdf.subarray(0, 5).toString("ascii") !== "%PDF-")
      throw new Error("Invoice attachment is invalid");
  }
};

/** Validate the server-only provider snapshot without accepting arbitrary headers or recipients. */
export function readPreparedEmailDelivery(value: unknown, destination: string): PreparedEmailDelivery {
  const body = value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
  const sender = typeof body.from === "string" ? body.from : "";
  const senderAddress = sender.match(/^(?:"[^"\\\r\n]{0,100}" )?<([^<>\s]+)>$/)?.[1] || sender;
  if (Object.keys(body).some(key => !["from", "to", "reply_to", "subject", "html", "text", "attachments"].includes(key)) ||
    !validEmail(senderAddress) || typeof body.to !== "string" || body.to !== destination || !validEmail(body.to) ||
    (body.reply_to !== undefined && (typeof body.reply_to !== "string" || !validEmail(body.reply_to))) ||
    typeof body.subject !== "string" || !body.subject || body.subject.length > 500 || /[\r\n]/.test(body.subject) ||
    typeof body.html !== "string" || body.html.length > 2 * 1024 * 1024 || typeof body.text !== "string" || body.text.length > 2 * 1024 * 1024)
    throw new EmailConfigurationError("Stored email delivery details require review before retrying");
  try { validAttachments(body.attachments as EmailAttachment[] | undefined); }
  catch { throw new EmailConfigurationError("Stored invoice attachment requires review before retrying"); }
  return body as PreparedEmailDelivery;
}

export function prepareResendEmail({ publicConfig, destination, content }: {
  publicConfig: Record<string, unknown>; destination: string; content: EmailContent;
}): PreparedEmailDelivery {
  const fromEmail = String(publicConfig.fromEmail || "").trim();
  const replyTo = String(publicConfig.replyTo || "").trim();
  if (!validEmail(fromEmail)) throw new EmailConfigurationError("Resend requires a valid sender email");
  if (replyTo && !validEmail(replyTo)) throw new EmailConfigurationError("Resend requires a valid reply-to email");
  if (!validEmail(destination)) throw new Error("Email recipient is invalid");
  validAttachments(content.attachments);
  const fromName = String(publicConfig.fromName || "").replace(/[\r\n]/g, " ").replace(/["\\]/g, "").replace(/\s+/g, " ").trim().slice(0, 100);
  const body = { from: fromName ? `"${fromName}" <${fromEmail}>` : fromEmail, to: destination, ...content, ...(replyTo ? { reply_to: replyTo } : {}) };
  return readPreparedEmailDelivery(body, destination);
}

/** One server-only sender for queued orders and the administrator's delivery check. */
export async function sendResendEmail({ credentials, publicConfig, destination, content, delivery, idempotencyKey, request = fetch }: {
  credentials: Record<string, string>; publicConfig: Record<string, unknown>;
  destination: string; content: EmailContent; delivery?: PreparedEmailDelivery; idempotencyKey: string; request?: typeof fetch;
}) {
  if (!credentials.apiKey) throw new EmailConfigurationError("Resend requires an API key");
  const body = delivery ? readPreparedEmailDelivery(delivery, destination) : prepareResendEmail({ publicConfig, destination, content });
  const response = await request("https://api.resend.com/emails", {
    method: "POST",
    headers: { authorization: `Bearer ${credentials.apiKey}`, "content-type": "application/json", "idempotency-key": idempotencyKey },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(10_000),
  });
  const result = await response.json().catch(() => ({})) as { id?: string };
  if ([401, 403].includes(response.status)) throw new EmailConfigurationError("Resend authorization or sender verification requires attention");
  if (!response.ok) throw new Error(`Resend rejected email with status ${response.status}`);
  if (!result.id || typeof result.id !== "string") throw new Error("Resend accepted response did not include a message ID");
  return result.id;
}
