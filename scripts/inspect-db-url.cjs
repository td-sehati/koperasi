require('dotenv').config();

if (!process.env.DATABASE_URL) {
  console.log(JSON.stringify({ ok: false, error: 'DATABASE_URL missing' }, null, 2));
  process.exit(1);
}

const u = new URL(process.env.DATABASE_URL);
console.log(
  JSON.stringify(
    {
      ok: true,
      host: u.hostname,
      port: u.port,
      user: decodeURIComponent(u.username),
      database: u.pathname.replace(/^\//, ''),
      hasPassword: Boolean(u.password),
    },
    null,
    2
  )
);
