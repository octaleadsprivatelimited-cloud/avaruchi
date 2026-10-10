import nextEnv from '@next/env';
import mysql from 'mysql2/promise';
nextEnv.loadEnvConfig(process.cwd());
// This helper is only for a disposable local test database. It is never an API route.
export async function administratorSession() {
  if (process.env.TEST_ADMIN_COOKIE) return process.env.TEST_ADMIN_COOKIE;
  if (process.env.TEST_ALLOW_DATABASE_FIXTURES !== 'true' ||
      !['127.0.0.1','localhost'].includes(process.env.DB_HOST) ||
      !process.env.DB_NAME?.endsWith('_test')) {
    throw new Error('Set TEST_ADMIN_COOKIE or explicitly enable fixtures against a loopback *_test database.');
  }
  const conn = await mysql.createConnection({host:process.env.DB_HOST,port:Number(process.env.DB_PORT),user:process.env.DB_USER,password:process.env.DB_PASSWORD||'',database:process.env.DB_NAME});
  try {
    const id = 'google:' + process.env.ADMIN_GOOGLE_SUB;
    if (!process.env.ADMIN_GOOGLE_SUB) throw new Error('Set a test ADMIN_GOOGLE_SUB.');
    const session = crypto.randomUUID() + crypto.randomUUID();
    await conn.execute("INSERT IGNORE INTO users(id,name,kind,email) VALUES (?,'Local test administrator','google','audit@example.invalid')", [id]);
    await conn.execute('INSERT INTO sessions(id,user_id,expires) VALUES (?,?,?)', [session,id,Date.now()+3600000]);
    return 'avr_session=' + session;
  } finally { await conn.end(); }
}
export async function setTestPayment(id, payment) {
  if (process.env.TEST_ALLOW_DATABASE_FIXTURES !== 'true' || !['127.0.0.1','localhost'].includes(process.env.DB_HOST) || !process.env.DB_NAME?.endsWith('_test')) throw new Error('Payment fixtures require a disposable local database.');
  const conn=await mysql.createConnection({host:process.env.DB_HOST,port:Number(process.env.DB_PORT),user:process.env.DB_USER,password:process.env.DB_PASSWORD||'',database:process.env.DB_NAME});
  try { await conn.execute('UPDATE orders SET payment=? WHERE id=?',[payment,id]); } finally { await conn.end(); }
}
