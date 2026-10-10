type AdminConfig = {
  ADMIN_GOOGLE_SUB?: string;
  ADMIN_DEMO_USER_ID?: string;
  DEMO_MODE?: string;
  DEMO_ADMIN_ENABLED?: string;
};
type SessionUser = { id: string; kind: string } | null | undefined;

// One active identity. A configured Google administrator always replaces preview access.
// Malformed configuration fails closed rather than activating a fallback account.
export function hasAdministrator(
  user: SessionUser,
  config: AdminConfig,
): boolean {
  if (!user) return false;
  if (config.ADMIN_GOOGLE_SUB) {
    return (
      /^[A-Za-z0-9_-]{1,255}$/.test(config.ADMIN_GOOGLE_SUB) &&
      user.kind === "google" &&
      user.id === "google:" + config.ADMIN_GOOGLE_SUB
    );
  }
  return (
    config.DEMO_MODE === "true" &&
    config.DEMO_ADMIN_ENABLED === "true" &&
    /^demo:[A-Za-z0-9_-]{1,255}$/.test(config.ADMIN_DEMO_USER_ID || "") &&
    user.kind === "demo" &&
    user.id === config.ADMIN_DEMO_USER_ID
  );
}
