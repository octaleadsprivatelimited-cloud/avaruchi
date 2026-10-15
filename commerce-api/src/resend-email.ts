type EmailContent = { subject: string; html: string; text: string };
export class EmailConfigurationError extends Error {}
const validEmail = (value: string) => value.length <= 254 && /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(value);

/** One server-only sender for queued orders and the administrator's delivery check. */
export async function sendResendEmail({ credentials, publicConfig, destination, content, idempotencyKey, request = fetch }: {
  credentials: Record<string, string>; publicConfig: Record<string, unknown>;
  destination: string; content: EmailContent; idempotencyKey: string; request?: typeof fetch;
}) {
  const fromEmail = String(publicConfig.fromEmail || "").trim();
  const replyTo = String(publicConfig.replyTo || "").trim();
  if (!validEmail(fromEmail)) throw new EmailConfigurationError("Resend requires a valid sender email");
  if (replyTo && !validEmail(replyTo)) throw new EmailConfigurationError("Resend requires a valid reply-to email");
  if (!credentials.apiKey) throw new EmailConfigurationError("Resend requires an API key");
  if (!validEmail(destination)) throw new Error("Email recipient is invalid");
  const fromName = String(publicConfig.fromName || "").replace(/[\r\n]/g, " ").replace(/["\\]/g, "").replace(/\s+/g, " ").trim().slice(0, 100);
  const response = await request("https://api.resend.com/emails", {
    method: "POST",
    headers: { authorization: `Bearer ${credentials.apiKey}`, "content-type": "application/json", "idempotency-key": idempotencyKey },
    body: JSON.stringify({ from: fromName ? `"${fromName}" <${fromEmail}>` : fromEmail, to: destination, ...content, ...(replyTo ? { reply_to: replyTo } : {}) }),
    signal: AbortSignal.timeout(10_000),
  });
  const body = await response.json().catch(() => ({})) as { id?: string };
  if ([401, 403].includes(response.status)) throw new EmailConfigurationError("Resend authorization or sender verification requires attention");
  if (!response.ok) throw new Error(`Resend rejected email with status ${response.status}`);
  if (!body.id || typeof body.id !== "string") throw new Error("Resend accepted response did not include a message ID");
  return body.id;
}
