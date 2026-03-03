import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import Database from 'better-sqlite3';
import { Client } from 'pg';

const APPLY = process.argv.includes('--apply');
const ROOT = process.cwd();
const SQLITE_PATH = process.env.DB_PATH || 'koperasi.db';
const SCHEMA_PATH = path.join(ROOT, 'scripts', 'supabase-schema.sql');

const TABLES = [
  'users',
  'sessions',
  'members',
  'savings',
  'saving_withdrawals',
  'loans',
  'loan_payments',
];

const withNoVerifySSL = (url) => {
  const sep = url.includes('?') ? '&' : '?';
  if (/sslmode=/i.test(url)) {
    return url.replace(/sslmode=[^&]+/i, 'sslmode=no-verify');
  }
  return `${url}${sep}sslmode=no-verify`;
};

function getSQLiteRows(sqlite) {
  const data = {};
  for (const table of TABLES) {
    data[table] = sqlite.prepare(`SELECT * FROM ${table}`).all();
  }
  return data;
}

async function ensureSchema(pg) {
  const schemaSql = fs.readFileSync(SCHEMA_PATH, 'utf8');
  await pg.query(schemaSql);
}

async function upsertRows(pg, table, rows) {
  if (!rows.length) return 0;

  const cols = Object.keys(rows[0]);
  const quotedCols = cols.map((c) => `"${c}"`).join(', ');
  const updates = cols.map((c) => `"${c}" = EXCLUDED."${c}"`).join(', ');

  let conflict = '"id"';
  if (table === 'sessions') conflict = '"token"';

  let inserted = 0;
  for (const row of rows) {
    const values = cols.map((c) => row[c]);
    const placeholders = values.map((_, i) => `$${i + 1}`).join(', ');
    const sql = `
      INSERT INTO ${table} (${quotedCols})
      VALUES (${placeholders})
      ON CONFLICT (${conflict}) DO UPDATE SET ${updates}
    `;
    await pg.query(sql, values);
    inserted += 1;
  }
  return inserted;
}

async function resetSequence(pg, table) {
  await pg.query(`
    SELECT setval(
      pg_get_serial_sequence('${table}', 'id'),
      COALESCE((SELECT MAX(id) FROM ${table}), 1),
      (SELECT EXISTS (SELECT 1 FROM ${table}))
    )
  `);
}

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL belum diisi di .env');
  if (!fs.existsSync(SQLITE_PATH)) throw new Error(`SQLite DB tidak ditemukan: ${SQLITE_PATH}`);

  const sqlite = new Database(SQLITE_PATH, { readonly: true });
  const snapshot = getSQLiteRows(sqlite);

  const summary = Object.fromEntries(TABLES.map((t) => [t, snapshot[t].length]));
  console.log(JSON.stringify({ mode: APPLY ? 'apply' : 'dry-run', sqlite: summary }, null, 2));

  if (!APPLY) return;

  const pg = new Client({
    connectionString: withNoVerifySSL(url),
  });
  await pg.connect();

  try {
    await pg.query('BEGIN');
    await ensureSchema(pg);

    for (const table of TABLES) {
      await upsertRows(pg, table, snapshot[table]);
    }

    for (const table of TABLES) {
      if (table !== 'sessions') {
        await resetSequence(pg, table);
      }
    }

    await pg.query('COMMIT');
    console.log(JSON.stringify({ ok: true, imported: summary }, null, 2));
  } catch (err) {
    await pg.query('ROLLBACK');
    throw err;
  } finally {
    await pg.end();
    sqlite.close();
  }
}

main().catch((err) => {
  console.error(JSON.stringify({ ok: false, error: err.message }, null, 2));
  process.exit(1);
});
