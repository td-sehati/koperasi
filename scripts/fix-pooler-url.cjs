const fs = require('fs');

const envPath = '.env';
const raw = fs.readFileSync(envPath, 'utf8');
const lines = raw.split(/\r?\n/);

const get = (key) => {
  const line = lines.find((l) => l.startsWith(`${key}=`));
  return line ? line.slice(key.length + 1) : '';
};

const password = get('SUPABASE_DB_PASSWORD');
const direct = get('DATABASE_URL_DIRECT');

if (!password || !direct) {
  throw new Error('SUPABASE_DB_PASSWORD atau DATABASE_URL_DIRECT belum terisi.');
}

let ref = '';
try {
  const u = new URL(direct);
  const m = u.hostname.match(/^db\.([^.]+)\.supabase\.co$/);
  if (m) ref = m[1];
} catch (e) {}

if (!ref) {
  throw new Error('Project ref tidak bisa dibaca dari DATABASE_URL_DIRECT.');
}

const newPooler = `postgresql://postgres.${ref}:${password}@aws-1-ap-southeast-1.pooler.supabase.com:5432/postgres?sslmode=require`;

const updated = lines.map((l) => (l.startsWith('DATABASE_URL=') ? `DATABASE_URL=${newPooler}` : l)).join('\n');
fs.writeFileSync(envPath, updated, 'utf8');
console.log(JSON.stringify({ ok: true, projectRef: ref }, null, 2));
