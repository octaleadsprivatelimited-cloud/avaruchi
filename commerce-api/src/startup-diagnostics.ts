/** Identify startup failures without logging CLI output or connection details. */
export function migrationFailureCode(error: unknown) {
  const failure = error as { stdout?: unknown; stderr?: unknown; code?: unknown; signal?: unknown } | null;
  const output = `${failure?.stderr || ""}${failure?.stdout || ""}`;
  const known = output.match(/\b(?:P\d{4}|ERR_REQUIRE_ESM|ERR_REQUIRE_ASYNC_MODULE|ERR_MODULE_NOT_FOUND|MODULE_NOT_FOUND|ERR_PACKAGE_PATH_NOT_EXPORTED|ERR_DLOPEN_FAILED|EAGAIN|ENOMEM|ENOSPC|ENOENT|EACCES)\b/)?.[0];
  if (known) return known;
  if (typeof failure?.code === "string" && /^(?:EAGAIN|ENOMEM|ENOSPC|ENOENT|EACCES|EPERM)$/.test(failure.code)) return failure.code;
  if (typeof failure?.signal === "string" && /^SIG(?:KILL|TERM|ABRT|SEGV)$/.test(failure.signal)) return failure.signal;
  if (typeof failure?.code === "number" && Number.isInteger(failure.code) && failure.code >= 0 && failure.code <= 255) return `EXIT_${failure.code}`;
  return undefined;
}
