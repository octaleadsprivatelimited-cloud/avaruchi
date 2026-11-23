/** Accept WhatsApp's direct contact and business short links. */
export function whatsappChatHref(value: unknown) {
  if (typeof value !== "string" || value.length > 512) return "";
  try {
    const url = new URL(value);
    if (url.origin !== "https://wa.me" || url.username || url.password || url.hash) return "";
    if (!/^\/(?:[1-9][0-9]{6,14}|message\/[A-Za-z0-9_-]{3,80})\/?$/.test(url.pathname)) return "";

    const queryKeys = [...url.searchParams.keys()];
    if (queryKeys.length > 1 || queryKeys.some(key => key !== "text")) return "";
    return url.href;
  } catch {
    return "";
  }
}
