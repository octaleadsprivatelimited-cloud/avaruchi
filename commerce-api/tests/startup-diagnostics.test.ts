import { expect, it } from "vitest";
import { migrationFailureCode } from "../src/startup-diagnostics.js";

it("identifies CLI, runtime and resource failures without exposing private output", () => {
  expect(migrationFailureCode({ stderr: "mysql://private:password@database/store P1001" })).toBe("P1001");
  expect(migrationFailureCode({ stderr: "Error ERR_REQUIRE_ESM in private-path" })).toBe("ERR_REQUIRE_ESM");
  expect(migrationFailureCode({ code: "EAGAIN", message: "private details" })).toBe("EAGAIN");
  expect(migrationFailureCode({ signal: "SIGKILL", stderr: "private details" })).toBe("SIGKILL");
  expect(migrationFailureCode({ code: 1, stdout: "private configuration" })).toBe("EXIT_1");
  expect(migrationFailureCode({ code: "private-secret", stdout: "private configuration" })).toBeUndefined();
});
