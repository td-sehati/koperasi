import 'dotenv/config';
import { Client } from 'pg';

const withNoVerifySSL = (url) => {
  const sep = url.includes('?') ? '&' : '?';
  if (/sslmode=/i.test(url)) {
    return url.replace(/sslmode=[^&]+/i, 'sslmode=no-verify');
  }
  return `${url}${sep}sslmode=no-verify`;
};

async function main() {
  const useDirect = process.argv.includes('--direct');
  const url = useDirect ? process.env.DATABASE_URL_DIRECT : process.env.DATABASE_URL;
  if (!url) {
    throw new Error(useDirect ? 'DATABASE_URL_DIRECT belum diisi di .env' : 'DATABASE_URL belum diisi di .env');
  }

  const client = new Client({
    connectionString: withNoVerifySSL(url),
  });

  await client.connect();
  const now = await client.query('SELECT NOW() as now, current_database() as db');
  console.log(JSON.stringify({
    ok: true,
    mode: useDirect ? 'direct' : 'pooler',
    db: now.rows[0].db,
    now: now.rows[0].now,
  }, null, 2));
  await client.end();
}

main().catch((err) => {
  console.error(JSON.stringify({ ok: false, error: err.message }, null, 2));
  process.exit(1);
});
