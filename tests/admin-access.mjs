import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import ts from "typescript";
const source = await readFile("lib/admin-access.ts", "utf8");
const js = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.ES2022,
    target: ts.ScriptTarget.ES2022,
  },
}).outputText;
const { hasAdministrator } = await import(
  "data:text/javascript;base64," + Buffer.from(js).toString("base64")
);
const google = { id: "google:owner-subject", kind: "google" };
const demo = { id: "demo:preview-owner", kind: "demo" };
const users = [
  google,
  demo,
  { id: "google:customer", kind: "google" },
  { id: google.id, kind: "demo" },
  { id: demo.id, kind: "google" },
  null,
];
let checks = 0;
function expect(user, config, value) {
  assert.equal(hasAdministrator(user, config), value);
  checks++;
}
const both = {
  ADMIN_GOOGLE_SUB: "owner-subject",
  ADMIN_DEMO_USER_ID: demo.id,
  DEMO_MODE: "true",
  DEMO_ADMIN_ENABLED: "true",
};
for (const user of users) expect(user, both, user === google);
for (const user of users)
  expect(user, { ...both, ADMIN_GOOGLE_SUB: "" }, user === demo);
for (const user of users)
  expect(user, { ...both, DEMO_MODE: "false" }, user === google);
for (const subject of [
  "owner-subject,customer",
  "owner-subject customer",
  " owner-subject",
  "google:owner-subject",
  "owner-subject\ncustomer",
  "x".repeat(256),
]) {
  for (const user of [google, demo])
    expect(user, { ...both, ADMIN_GOOGLE_SUB: subject }, false);
}
for (const user of users)
  expect(user, { ...both, ADMIN_GOOGLE_SUB: "", DEMO_MODE: "false" }, false);
for (const user of users)
  expect(
    user,
    { ...both, ADMIN_GOOGLE_SUB: "", DEMO_ADMIN_ENABLED: "false" },
    false,
  );
expect(google, { ...both, ADMIN_GOOGLE_SUB: "replacement" }, false);
expect(
  { id: "google:replacement", kind: "google" },
  { ...both, ADMIN_GOOGLE_SUB: "replacement" },
  true,
);
expect(demo, { ...both, ADMIN_GOOGLE_SUB: "replacement" }, false);
expect(
  { id: "google:customer", kind: "google", email: "owner@example.invalid" },
  both,
  false,
);
expect(
  demo,
  { DEMO_MODE: "true", ADMIN_PLATFORM_USER_ID: "claimed-owner" },
  false,
);
console.log(
  `${checks} single-administrator checks passed: exclusive identity, preview precedence, live-mode restrictions, invalid lists, account replacement and customer denial.`,
);
