import mysql, {
  type Pool,
  type PoolConnection,
  type RowDataPacket,
  type ResultSetHeader,
} from "mysql2/promise";
export type DatabaseResult<T = any> = {
  results: T[];
  meta: { changes: number; last_row_id: number };
};
export interface Statement {
  sql: string;
  values: any[];
  bind(...values: any[]): Statement;
  first<T = any>(): Promise<T | null>;
  all<T = any>(): Promise<DatabaseResult<T>>;
  run(): Promise<DatabaseResult>;
}
export interface Database {
  prepare(sql: string): Statement;
  batch(statements: Statement[]): Promise<DatabaseResult[]>;
  transaction<T>(action: (db: Database) => Promise<T>): Promise<T>;
}
let pool: Pool | undefined;
function connectionPool() {
  if (!process.env.DB_NAME || !process.env.DB_USER)
    throw new Error(
      "Configure the Hostinger MySQL database before starting the store.",
    );
  pool ??= mysql.createPool({
    host: process.env.DB_HOST || "localhost",
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD || "",
    database: process.env.DB_NAME,
    connectionLimit: 5,
    waitForConnections: true,
    queueLimit: 50,
    supportBigNumbers: true,
    bigNumberStrings: false,
    ...(process.env.DB_SSL === "true"
      ? { ssl: { rejectUnauthorized: true } }
      : {}),
  });
  return pool;
}
// These translations cover the existing store's parameterized SQLite upserts only.
// All values remain bound parameters; identifiers never come from a request.
function mysqlSql(sql: string) {
  return sql
    .replace(/INSERT OR IGNORE INTO/g, "INSERT IGNORE INTO")
    .replace(
      /ON CONFLICT\([a-z_]+\) DO UPDATE SET (.*)$/i,
      (_, columns: string) =>
        "ON DUPLICATE KEY UPDATE " +
        columns.replace(/excluded\.([a-z_]+)/g, "VALUES($1)"),
    );
}
class MysqlDatabase implements Database {
  constructor(private connection?: PoolConnection) {}
  prepare(sql: string): Statement {
    const db = this;
    const make = (values: any[]): Statement => ({
      sql,
      values,
      bind: (...values) => make(values),
      first: async <T>() =>
        ((await db.execute(sql, values)).results[0] ?? null) as T | null,
      all: async <T>() => db.execute(sql, values) as Promise<DatabaseResult<T>>,
      run: () => db.execute(sql, values),
    });
    return make([]);
  }
  private async execute(sql: string, values: any[]) {
    const [rows] = await (this.connection ?? connectionPool()).query<
      RowDataPacket[] | ResultSetHeader
    >(mysqlSql(sql), values);
    return Array.isArray(rows)
      ? { results: rows, meta: { changes: 0, last_row_id: 0 } }
      : {
          results: [],
          meta: { changes: rows.affectedRows, last_row_id: rows.insertId },
        };
  }
  batch(statements: Statement[]) {
    return this.transaction(async (tx) => {
      const results: DatabaseResult[] = [];
      for (const s of statements)
        results.push(
          await tx
            .prepare(s.sql)
            .bind(...s.values)
            .run(),
        );
      return results;
    });
  }
  async transaction<T>(action: (db: Database) => Promise<T>): Promise<T> {
    if (this.connection) return action(this);
    for (let attempt = 0; ; attempt++) {
      const connection = await connectionPool().getConnection();
      try {
        // A failed NOT NULL inventory guard must throw rather than coerce a value.
        await connection.query(
          "SET SESSION sql_mode='STRICT_TRANS_TABLES,NO_ENGINE_SUBSTITUTION'",
        );
        await connection.beginTransaction();
        const result = await action(new MysqlDatabase(connection));
        await connection.commit();
        return result;
      } catch (error: any) {
        await connection.rollback();
        if (
          attempt < 2 &&
          ["ER_LOCK_DEADLOCK", "ER_LOCK_WAIT_TIMEOUT"].includes(error.code)
        )
          continue;
        throw error;
      } finally {
        connection.release();
      }
    }
  }
}
const database = new MysqlDatabase();
export const storeDatabase = () => database;
