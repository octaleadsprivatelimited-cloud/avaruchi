import { readFile, readdir } from "node:fs/promises";
import nextEnv from "@next/env";
const { loadEnvConfig } = nextEnv;
import mysql from "mysql2/promise";
loadEnvConfig(process.cwd());
if (!process.env.DB_NAME || !process.env.DB_USER)
  throw new Error(
    "Set DB_NAME and DB_USER in Hostinger environment variables or .env.local first.",
  );
const db = await mysql.createConnection({
  host: process.env.DB_HOST || "localhost",
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD || "",
  database: process.env.DB_NAME,
  ...(process.env.DB_SSL === "true"
    ? { ssl: { rejectUnauthorized: true } }
    : {}),
});
try {
  const directory = new URL("../database/", import.meta.url);
  for (const filename of (await readdir(directory))
    .filter((x) => /^\d+.*\.sql$/.test(x))
    .sort()) {
    const sql = await readFile(new URL(filename, directory), "utf8");
    for (const statement of sql
      .split(";")
      .map((s) => s.trim())
      .filter(Boolean))
      await db.query(statement);
  }
  console.log("Avaruchi MySQL schema ready. Existing store data preserved.");
} finally {
  await db.end();
}
