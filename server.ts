import "dotenv/config";
import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import fs from "fs";
import crypto from "crypto";
import { Pool } from "pg";

const app = express();
const PORT = Number(process.env.PORT || 3000);
const readEnv = (key: string) => process.env[key]?.trim().replace(/^['"]|['"]$/g, "");
const DATABASE_URL = readEnv("DATABASE_URL") || readEnv("DATABASE_URL_DIRECT");
if (!DATABASE_URL) {
  throw new Error("DATABASE_URL belum diisi. Set DATABASE_URL atau DATABASE_URL_DIRECT di environment deploy.");
}

const withNoVerifySSL = (url: string) => {
  const sep = url.includes("?") ? "&" : "?";
  if (/sslmode=/i.test(url)) return url.replace(/sslmode=[^&]+/i, "sslmode=no-verify");
  return `${url}${sep}sslmode=no-verify`;
};

const pool = new Pool({
  connectionString: withNoVerifySSL(DATABASE_URL),
});

type AppUser = {
  id: number;
  username: string;
  role: "admin" | "officer";
  token: string;
};

const addDaysISO = (days: number, from = Date.now()) => new Date(from + days * 24 * 60 * 60 * 1000).toISOString();

const getSubscriptionMeta = (subscriptionEndAt?: string | null) => {
  if (!subscriptionEndAt) return { daysLeft: null, warningH2: false, expired: false };
  const diffMs = new Date(subscriptionEndAt).getTime() - Date.now();
  const daysLeft = Math.ceil(diffMs / (24 * 60 * 60 * 1000));
  return {
    daysLeft,
    warningH2: daysLeft >= 0 && daysLeft <= 2,
    expired: daysLeft < 0,
  };
};

const paymentInstructions = {
  feeLabel: process.env.SUBSCRIPTION_FEE_LABEL || "Rp 100.000 / 30 hari",
  payTo: process.env.SUBSCRIPTION_PAY_TO || "Transfer ke rekening owner aplikasi",
  confirmTo: process.env.SUBSCRIPTION_CONFIRM_TO || "Konfirmasi via WhatsApp ke owner aplikasi",
};

const validCollectionDays = ["Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu", "Minggu"];

const hashPassword = (password: string) => {
  const salt = crypto.randomBytes(16).toString("hex");
  const derived = crypto.scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${derived}`;
};

const verifyPassword = (password: string, storedHash: string) => {
  const [salt, hash] = storedHash.split(":");
  if (!salt || !hash) return false;
  const derived = crypto.scryptSync(password, salt, 64).toString("hex");
  return crypto.timingSafeEqual(Buffer.from(hash, "hex"), Buffer.from(derived, "hex"));
};

async function initDb() {
  const schemaPath = path.resolve("scripts/supabase-schema.sql");
  const schemaSql = fs.readFileSync(schemaPath, "utf8");
  await pool.query(schemaSql);

  const defaultAdminUsername = process.env.ADMIN_USERNAME || "owner";
  const defaultAdminPassword = process.env.ADMIN_PASSWORD || "owner123";

  const adminCountRes = await pool.query<{ count: string }>("SELECT COUNT(*)::text as count FROM users WHERE role = 'admin'");
  const adminCount = Number(adminCountRes.rows[0]?.count || "0");
  if (adminCount === 0) {
    await pool.query(
      "INSERT INTO users (username, password_hash, role, active) VALUES ($1, $2, 'admin', 1)",
      [defaultAdminUsername, hashPassword(defaultAdminPassword)]
    );
    console.log(`[auth] default admin created: ${defaultAdminUsername}`);
  }

  const firstAdminRes = await pool.query<{ id: number }>("SELECT id FROM users WHERE role = 'admin' ORDER BY id ASC LIMIT 1");
  const firstAdminId = firstAdminRes.rows[0]?.id;
  if (firstAdminId) {
    await pool.query("UPDATE members SET owner_user_id = $1 WHERE owner_user_id IS NULL", [firstAdminId]);
  }

  await pool.query(`
    UPDATE users
    SET subscription_start_at = COALESCE(subscription_start_at, created_at),
        subscription_end_at = COALESCE(subscription_end_at, subscription_start_at + INTERVAL '30 day', created_at + INTERVAL '30 day')
    WHERE role = 'officer'
  `);

  await pool.query(`
    UPDATE users
    SET active = 0
    WHERE role = 'officer'
      AND subscription_end_at IS NOT NULL
      AND subscription_end_at < NOW()
  `);
}

app.use(express.json());

app.post("/api/auth/login", async (req, res) => {
  try {
    const { username, password } = req.body || {};
    if (!username || !password) return res.status(400).json({ error: "Username dan password wajib diisi." });

    const userRes = await pool.query<{
      id: number;
      username: string;
      password_hash: string;
      role: "admin" | "officer";
      active: number;
      subscription_start_at: string | null;
      subscription_end_at: string | null;
    }>(
      "SELECT id, username, password_hash, role, active, subscription_start_at, subscription_end_at FROM users WHERE username = $1",
      [username]
    );
    const user = userRes.rows[0];
    if (!user || !verifyPassword(password, user.password_hash)) {
      return res.status(401).json({ error: "Username atau password salah." });
    }

    if (user.role === "officer") {
      const meta = getSubscriptionMeta(user.subscription_end_at);
      if (meta.expired) {
        await pool.query("UPDATE users SET active = 0 WHERE id = $1", [user.id]);
        return res.status(403).json({
          error: "Masa langganan akun sudah habis. Silakan hubungi owner untuk perpanjangan.",
          code: "SUBSCRIPTION_EXPIRED",
          paymentInstructions,
        });
      }
    }

    if (user.active !== 1) {
      return res.status(403).json({ error: "Akun nonaktif. Silakan hubungi owner aplikasi." });
    }

    const token = crypto.randomBytes(32).toString("hex");
    const expiresAt = addDaysISO(7);
    await pool.query("INSERT INTO sessions (token, user_id, expires_at) VALUES ($1, $2, $3::timestamptz)", [
      token,
      user.id,
      expiresAt,
    ]);

    return res.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        role: user.role,
        subscription_start_at: user.subscription_start_at,
        subscription_end_at: user.subscription_end_at,
        ...getSubscriptionMeta(user.subscription_end_at),
      },
      paymentInstructions,
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

app.use("/api", async (req, res, next) => {
  if (req.path === "/auth/login") return next();
  try {
    const authHeader = req.headers.authorization || "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";
    if (!token) return res.status(401).json({ error: "Unauthorized" });

    const sessionRes = await pool.query<{
      token: string;
      expires_at: string;
      id: number;
      username: string;
      role: "admin" | "officer";
      active: number;
      subscription_end_at: string | null;
    }>(
      `
      SELECT s.token, s.expires_at, u.id, u.username, u.role, u.active, u.subscription_end_at
      FROM sessions s
      JOIN users u ON u.id = s.user_id
      WHERE s.token = $1
    `,
      [token]
    );
    const session = sessionRes.rows[0];

    if (!session || session.active !== 1 || new Date(session.expires_at).getTime() <= Date.now()) {
      await pool.query("DELETE FROM sessions WHERE token = $1", [token]);
      return res.status(401).json({ error: "Session expired" });
    }

    if (session.role === "officer") {
      const meta = getSubscriptionMeta(session.subscription_end_at);
      if (meta.expired) {
        await pool.query("UPDATE users SET active = 0 WHERE id = $1", [session.id]);
        await pool.query("DELETE FROM sessions WHERE token = $1", [token]);
        return res.status(401).json({ error: "Subscription expired", code: "SUBSCRIPTION_EXPIRED" });
      }
    }

    (req as any).user = { id: session.id, username: session.username, role: session.role, token } as AppUser;
    return next();
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

const requireAdmin = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  if ((req as any).user?.role !== "admin") return res.status(403).json({ error: "Forbidden" });
  return next();
};

app.get("/api/auth/me", async (req, res) => {
  try {
    const userId = (req as any).user.id;
    const userRes = await pool.query<{
      id: number;
      username: string;
      role: "admin" | "officer";
      subscription_start_at: string | null;
      subscription_end_at: string | null;
    }>("SELECT id, username, role, subscription_start_at, subscription_end_at FROM users WHERE id = $1", [userId]);
    const user = userRes.rows[0];
    return res.json({
      id: user.id,
      username: user.username,
      role: user.role,
      subscription_start_at: user.subscription_start_at,
      subscription_end_at: user.subscription_end_at,
      ...getSubscriptionMeta(user.subscription_end_at),
      paymentInstructions,
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

app.post("/api/auth/logout", async (req, res) => {
  try {
    await pool.query("DELETE FROM sessions WHERE token = $1", [(req as any).user.token]);
    return res.json({ success: true });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

app.get("/api/admin/accounts", requireAdmin, async (_req, res) => {
  const q = await pool.query(
    "SELECT id, username, role, active, subscription_start_at, subscription_end_at, created_at FROM users ORDER BY created_at DESC"
  );
  return res.json(q.rows);
});

app.post("/api/admin/accounts", requireAdmin, async (req, res) => {
  try {
    const { username, password, role } = req.body || {};
    if (!username || !password) return res.status(400).json({ error: "Username dan password wajib diisi." });

    const normalizedRole = role === "admin" ? "admin" : "officer";
    const subStart = normalizedRole === "officer" ? new Date().toISOString() : null;
    const subEnd = normalizedRole === "officer" ? addDaysISO(30) : null;
    const q = await pool.query(
      "INSERT INTO users (username, password_hash, role, active, subscription_start_at, subscription_end_at) VALUES ($1, $2, $3, 1, $4::timestamptz, $5::timestamptz) RETURNING id",
      [username.trim(), hashPassword(password), normalizedRole, subStart, subEnd]
    );
    return res.json({ id: q.rows[0].id });
  } catch (err: any) {
    return res.status(400).json({ error: err.message });
  }
});

app.put("/api/admin/accounts/:id", requireAdmin, async (req, res) => {
  try {
    const targetId = Number(req.params.id);
    const { password, role, active } = req.body || {};
    const currentUser = (req as any).user as AppUser;
    if (active === 0 && targetId === currentUser.id) {
      return res.status(400).json({ error: "Akun admin aktif saat ini tidak boleh dinonaktifkan." });
    }

    if (password) await pool.query("UPDATE users SET password_hash = $1 WHERE id = $2", [hashPassword(password), targetId]);
    if (role) await pool.query("UPDATE users SET role = $1 WHERE id = $2", [role === "admin" ? "admin" : "officer", targetId]);
    if (typeof active === "number") await pool.query("UPDATE users SET active = $1 WHERE id = $2", [active ? 1 : 0, targetId]);

    return res.json({ success: true });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

app.post("/api/admin/accounts/:id/renew", requireAdmin, async (req, res) => {
  try {
    const targetId = Number(req.params.id);
    const renewDays = Number.isFinite(Number(req.body?.days)) && Number(req.body.days) > 0 ? Number(req.body.days) : 30;

    const q = await pool.query<{ role: string; subscription_end_at: string | null }>(
      "SELECT role, subscription_end_at FROM users WHERE id = $1",
      [targetId]
    );
    if (!q.rows[0]) return res.status(404).json({ error: "Akun tidak ditemukan." });
    if (q.rows[0].role !== "officer") return res.status(400).json({ error: "Perpanjangan hanya untuk akun officer." });

    const currentEndMs = q.rows[0].subscription_end_at ? new Date(q.rows[0].subscription_end_at).getTime() : 0;
    const base = currentEndMs > Date.now() ? currentEndMs : Date.now();
    const newEnd = addDaysISO(renewDays, base);

    await pool.query("UPDATE users SET subscription_end_at = $1::timestamptz, active = 1 WHERE id = $2", [newEnd, targetId]);
    await pool.query("DELETE FROM sessions WHERE user_id = $1", [targetId]);
    return res.json({ success: true, subscription_end_at: newEnd });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

app.delete("/api/admin/accounts/:id", requireAdmin, async (req, res) => {
  try {
    const targetId = Number(req.params.id);
    const currentUser = (req as any).user as AppUser;
    if (targetId === currentUser.id) return res.status(400).json({ error: "Akun sendiri tidak bisa dihapus." });
    await pool.query("BEGIN");
    await pool.query("DELETE FROM sessions WHERE user_id = $1", [targetId]);
    await pool.query("DELETE FROM users WHERE id = $1", [targetId]);
    await pool.query("COMMIT");
    return res.json({ success: true });
  } catch (err: any) {
    await pool.query("ROLLBACK");
    return res.status(500).json({ error: err.message });
  }
});

app.get("/api/members", async (req, res) => {
  const user = (req as any).user as AppUser;
  const q =
    user.role === "admin"
      ? await pool.query("SELECT * FROM members ORDER BY name ASC")
      : await pool.query("SELECT * FROM members WHERE owner_user_id = $1 ORDER BY name ASC", [user.id]);
  return res.json(q.rows);
});

app.post("/api/members", async (req, res) => {
  try {
    const user = (req as any).user as AppUser;
    const { name, ktp, address, rt_rw, kel, kec, business, business_location, region, registration_no, collection_day } = req.body;
    if (!validCollectionDays.includes(collection_day)) return res.status(400).json({ error: "Hari penagihan wajib dipilih." });
    const q = await pool.query(
      `
      INSERT INTO members (name, ktp, address, rt_rw, kel, kec, business, business_location, region, registration_no, collection_day, owner_user_id)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
      RETURNING id
    `,
      [name, ktp, address, rt_rw, kel, kec, business, business_location, region, registration_no, collection_day, user.id]
    );
    return res.json({ id: q.rows[0].id });
  } catch (err: any) {
    return res.status(400).json({ error: err.message });
  }
});

app.get("/api/members/:id", async (req, res) => {
  try {
    const user = (req as any).user as AppUser;
    const memberId = Number(req.params.id);
    const memberRes =
      user.role === "admin"
        ? await pool.query("SELECT * FROM members WHERE id = $1", [memberId])
        : await pool.query("SELECT * FROM members WHERE id = $1 AND owner_user_id = $2", [memberId, user.id]);
    const member = memberRes.rows[0];
    if (!member) return res.status(404).json({ error: "Member not found" });

    const savingsRes = await pool.query("SELECT * FROM savings WHERE member_id = $1 ORDER BY date DESC", [memberId]);
    const withdrawalsRes = await pool.query("SELECT * FROM saving_withdrawals WHERE member_id = $1 ORDER BY date DESC", [memberId]);
    const loansRes = await pool.query("SELECT * FROM loans WHERE member_id = $1 ORDER BY loan_date DESC", [memberId]);

    const loansWithPayments = await Promise.all(
      loansRes.rows.map(async (loan: any) => {
        const p = await pool.query("SELECT * FROM loan_payments WHERE loan_id = $1 ORDER BY payment_date DESC", [loan.id]);
        return { ...loan, payments: p.rows };
      })
    );

    return res.json({ ...member, savings: savingsRes.rows, withdrawals: withdrawalsRes.rows, loans: loansWithPayments });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

app.put("/api/members/:id", async (req, res) => {
  try {
    const user = (req as any).user as AppUser;
    const { name, ktp, address, rt_rw, kel, kec, business, business_location, region, registration_no, collection_day } = req.body;
    if (!validCollectionDays.includes(collection_day)) return res.status(400).json({ error: "Hari penagihan wajib dipilih." });

    const memberId = Number(req.params.id);
    const q =
      user.role === "admin"
        ? await pool.query(
            `
            UPDATE members
            SET name=$1, ktp=$2, address=$3, rt_rw=$4, kel=$5, kec=$6, business=$7, business_location=$8, region=$9, registration_no=$10, collection_day=$11
            WHERE id=$12
          `,
            [name, ktp, address, rt_rw, kel, kec, business, business_location, region, registration_no, collection_day, memberId]
          )
        : await pool.query(
            `
            UPDATE members
            SET name=$1, ktp=$2, address=$3, rt_rw=$4, kel=$5, kec=$6, business=$7, business_location=$8, region=$9, registration_no=$10, collection_day=$11
            WHERE id=$12 AND owner_user_id=$13
          `,
            [name, ktp, address, rt_rw, kel, kec, business, business_location, region, registration_no, collection_day, memberId, user.id]
          );
    if (q.rowCount === 0) return res.status(404).json({ error: "Member not found" });
    return res.json({ success: true });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

app.delete("/api/members/:id", async (req, res) => {
  try {
    const user = (req as any).user as AppUser;
    const memberId = Number(req.params.id);
    const memberRes =
      user.role === "admin"
        ? await pool.query("SELECT id FROM members WHERE id = $1", [memberId])
        : await pool.query("SELECT id FROM members WHERE id = $1 AND owner_user_id = $2", [memberId, user.id]);
    if (!memberRes.rows[0]) return res.status(404).json({ error: "Member tidak ditemukan." });

    const s = await pool.query<{ count: string }>("SELECT COUNT(*)::text as count FROM savings WHERE member_id = $1", [memberId]);
    const w = await pool.query<{ count: string }>("SELECT COUNT(*)::text as count FROM saving_withdrawals WHERE member_id = $1", [memberId]);
    const l = await pool.query<{ count: string }>("SELECT COUNT(*)::text as count FROM loans WHERE member_id = $1", [memberId]);
    if (Number(s.rows[0].count) > 0 || Number(w.rows[0].count) > 0 || Number(l.rows[0].count) > 0) {
      return res.status(400).json({ error: "Anggota tidak bisa dihapus karena masih memiliki keterikatan data pinjaman atau simpanan." });
    }
    await pool.query("DELETE FROM members WHERE id = $1", [memberId]);
    return res.json({ success: true });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

app.get("/api/loans/:id/payments", async (req, res) => {
  const user = (req as any).user as AppUser;
  const loanId = Number(req.params.id);
  const q =
    user.role === "admin"
      ? await pool.query("SELECT * FROM loan_payments WHERE loan_id = $1 ORDER BY installment_no ASC", [loanId])
      : await pool.query(
          `
          SELECT lp.*
          FROM loan_payments lp
          JOIN loans l ON l.id = lp.loan_id
          JOIN members m ON m.id = l.member_id
          WHERE lp.loan_id = $1 AND m.owner_user_id = $2
          ORDER BY lp.installment_no ASC
        `,
          [loanId, user.id]
        );
  return res.json(q.rows);
});

app.post("/api/savings", async (req, res) => {
  try {
    const user = (req as any).user as AppUser;
    const { member_id, date, description, wajib, khusus } = req.body;
    const memberRes =
      user.role === "admin"
        ? await pool.query("SELECT id FROM members WHERE id = $1", [member_id])
        : await pool.query("SELECT id FROM members WHERE id = $1 AND owner_user_id = $2", [member_id, user.id]);
    if (!memberRes.rows[0]) return res.status(403).json({ error: "Akses anggota ditolak." });

    const total = (parseInt(wajib) || 0) + (parseInt(khusus) || 0);
    const q = await pool.query(
      "INSERT INTO savings (member_id, date, description, wajib, khusus, total) VALUES ($1, $2::timestamptz, $3, $4, $5, $6) RETURNING id",
      [member_id, date, description, wajib, khusus, total]
    );
    return res.json({ id: q.rows[0].id });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

app.post("/api/savings/withdraw", async (req, res) => {
  try {
    const user = (req as any).user as AppUser;
    const { member_id, date, description, amount } = req.body;
    const memberRes =
      user.role === "admin"
        ? await pool.query("SELECT id FROM members WHERE id = $1", [member_id])
        : await pool.query("SELECT id FROM members WHERE id = $1 AND owner_user_id = $2", [member_id, user.id]);
    if (!memberRes.rows[0]) return res.status(403).json({ error: "Akses anggota ditolak." });

    const withdrawAmount = parseInt(amount);
    if (!Number.isFinite(withdrawAmount) || withdrawAmount <= 0) return res.status(400).json({ error: "Nominal pencairan harus lebih dari 0." });

    const inRes = await pool.query<{ total: string }>("SELECT COALESCE(SUM(total), 0)::text as total FROM savings WHERE member_id = $1", [member_id]);
    const outRes = await pool.query<{ total: string }>(
      "SELECT COALESCE(SUM(amount), 0)::text as total FROM saving_withdrawals WHERE member_id = $1",
      [member_id]
    );
    const availableBalance = Number(inRes.rows[0].total) - Number(outRes.rows[0].total);
    if (withdrawAmount > availableBalance) {
      return res.status(400).json({ error: "Saldo simpanan tidak mencukupi untuk pencairan ini." });
    }

    const q = await pool.query(
      "INSERT INTO saving_withdrawals (member_id, date, description, amount) VALUES ($1, $2::timestamptz, $3, $4) RETURNING id",
      [member_id, date, description, withdrawAmount]
    );
    return res.json({ id: q.rows[0].id });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

app.post("/api/loans", async (req, res) => {
  try {
    const user = (req as any).user as AppUser;
    const { member_id, loan_date, amount, admin_fee, disbursed_amount, installment_amount, weeks, total_to_pay, include_savings } = req.body;
    const memberRes =
      user.role === "admin"
        ? await pool.query("SELECT id FROM members WHERE id = $1", [member_id])
        : await pool.query("SELECT id FROM members WHERE id = $1 AND owner_user_id = $2", [member_id, user.id]);
    if (!memberRes.rows[0]) return res.status(403).json({ error: "Akses anggota ditolak." });

    await pool.query("BEGIN");
    await pool.query(
      `
      INSERT INTO loans (member_id, loan_date, amount, admin_fee, disbursed_amount, installment_amount, weeks, total_to_pay)
      VALUES ($1, $2::timestamptz, $3, $4, $5, $6, $7, $8)
    `,
      [member_id, loan_date, amount, admin_fee, disbursed_amount, installment_amount, weeks, total_to_pay]
    );
    if (include_savings) {
      const initialSavings = Math.round(amount * 0.05);
      await pool.query(
        `
        INSERT INTO savings (member_id, date, description, wajib, khusus, total)
        VALUES ($1, $2::timestamptz, $3, $4, 0, $4)
      `,
        [member_id, loan_date, "Simpanan Wajib Awal (Pinjaman)", initialSavings]
      );
    }
    await pool.query("COMMIT");
    return res.json({ success: true });
  } catch (err: any) {
    await pool.query("ROLLBACK");
    return res.status(500).json({ error: err.message });
  }
});

app.post("/api/loan-payments", async (req, res) => {
  try {
    const user = (req as any).user as AppUser;
    const { loan_id, payment_date, installment_no, amount_paid, remaining_balance } = req.body;

    const loanRes =
      user.role === "admin"
        ? await pool.query("SELECT id FROM loans WHERE id = $1", [loan_id])
        : await pool.query(
            `
            SELECT l.id
            FROM loans l
            JOIN members m ON m.id = l.member_id
            WHERE l.id = $1 AND m.owner_user_id = $2
          `,
            [loan_id, user.id]
          );
    if (!loanRes.rows[0]) return res.status(403).json({ error: "Akses pinjaman ditolak." });

    await pool.query("BEGIN");
    await pool.query(
      `
      INSERT INTO loan_payments (loan_id, payment_date, installment_no, amount_paid, remaining_balance)
      VALUES ($1, $2::timestamptz, $3, $4, $5)
    `,
      [loan_id, payment_date, installment_no, amount_paid, remaining_balance]
    );
    await pool.query("UPDATE loans SET total_to_pay = $1 WHERE id = $2", [remaining_balance, loan_id]);
    if (Number(remaining_balance) <= 0) await pool.query("UPDATE loans SET status = 'closed' WHERE id = $1", [loan_id]);
    await pool.query("COMMIT");
    return res.json({ success: true });
  } catch (err: any) {
    await pool.query("ROLLBACK");
    return res.status(500).json({ error: err.message });
  }
});

app.get("/api/stats", async (req, res) => {
  try {
    const user = (req as any).user as AppUser;
    const todayWIB = new Date(Date.now() + 7 * 3600000).toISOString().split("T")[0];

    const totalMembersQ =
      user.role === "admin"
        ? await pool.query<{ count: string }>("SELECT COUNT(*)::text as count FROM members")
        : await pool.query<{ count: string }>("SELECT COUNT(*)::text as count FROM members WHERE owner_user_id = $1", [user.id]);
    const totalMembers = Number(totalMembersQ.rows[0].count || "0");

    const todaySavingsInQ =
      user.role === "admin"
        ? await pool.query<{ total: string }>(
            `SELECT COALESCE(SUM(total),0)::text as total FROM savings WHERE (date AT TIME ZONE 'Asia/Jakarta')::date = $1::date`,
            [todayWIB]
          )
        : await pool.query<{ total: string }>(
            `
            SELECT COALESCE(SUM(s.total),0)::text as total
            FROM savings s
            JOIN members m ON m.id = s.member_id
            WHERE (s.date AT TIME ZONE 'Asia/Jakarta')::date = $1::date AND m.owner_user_id = $2
          `,
            [todayWIB, user.id]
          );
    const todayWithdrawalsQ =
      user.role === "admin"
        ? await pool.query<{ total: string }>(
            `SELECT COALESCE(SUM(amount),0)::text as total FROM saving_withdrawals WHERE (date AT TIME ZONE 'Asia/Jakarta')::date = $1::date`,
            [todayWIB]
          )
        : await pool.query<{ total: string }>(
            `
            SELECT COALESCE(SUM(w.amount),0)::text as total
            FROM saving_withdrawals w
            JOIN members m ON m.id = w.member_id
            WHERE (w.date AT TIME ZONE 'Asia/Jakarta')::date = $1::date AND m.owner_user_id = $2
          `,
            [todayWIB, user.id]
          );
    const todayPaymentsQ =
      user.role === "admin"
        ? await pool.query<{ total: string }>(
            `SELECT COALESCE(SUM(amount_paid),0)::text as total FROM loan_payments WHERE (payment_date AT TIME ZONE 'Asia/Jakarta')::date = $1::date`,
            [todayWIB]
          )
        : await pool.query<{ total: string }>(
            `
            SELECT COALESCE(SUM(lp.amount_paid),0)::text as total
            FROM loan_payments lp
            JOIN loans l ON l.id = lp.loan_id
            JOIN members m ON m.id = l.member_id
            WHERE (lp.payment_date AT TIME ZONE 'Asia/Jakarta')::date = $1::date AND m.owner_user_id = $2
          `,
            [todayWIB, user.id]
          );

    const todaySavings = Number(todaySavingsInQ.rows[0].total) - Number(todayWithdrawalsQ.rows[0].total);
    const todayPayments = Number(todayPaymentsQ.rows[0].total);
    const todayWithdrawals = Number(todayWithdrawalsQ.rows[0].total);

    return res.json({
      totalMembers,
      todayCollections: todaySavings + todayPayments,
      todaySavings,
      todayWithdrawals,
      todayPayments,
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

app.get("/api/reports/daily", async (req, res) => {
  try {
    const user = (req as any).user as AppUser;
    const savingsQ =
      user.role === "admin"
        ? await pool.query<{ date: string; total: number }>("SELECT date, total FROM savings")
        : await pool.query<{ date: string; total: number }>(
            `
            SELECT s.date, s.total
            FROM savings s
            JOIN members m ON m.id = s.member_id
            WHERE m.owner_user_id = $1
          `,
            [user.id]
          );
    const withdrawalsQ =
      user.role === "admin"
        ? await pool.query<{ date: string; total: number }>("SELECT date, amount as total FROM saving_withdrawals")
        : await pool.query<{ date: string; total: number }>(
            `
            SELECT w.date, w.amount as total
            FROM saving_withdrawals w
            JOIN members m ON m.id = w.member_id
            WHERE m.owner_user_id = $1
          `,
            [user.id]
          );
    const paymentsQ =
      user.role === "admin"
        ? await pool.query<{ date: string; total: number }>("SELECT payment_date as date, amount_paid as total FROM loan_payments")
        : await pool.query<{ date: string; total: number }>(
            `
            SELECT lp.payment_date as date, lp.amount_paid as total
            FROM loan_payments lp
            JOIN loans l ON l.id = lp.loan_id
            JOIN members m ON m.id = l.member_id
            WHERE m.owner_user_id = $1
          `,
            [user.id]
          );

    const reportMap = new Map<string, { date: string; savings: number; withdrawals: number; netSavings: number; payments: number }>();
    const processItem = (item: { date: string; total: number }, type: "savings" | "withdrawals" | "payments") => {
      const dateStr = new Date(new Date(item.date).getTime() + 7 * 3600000).toISOString().split("T")[0];
      const existing = reportMap.get(dateStr) || { date: dateStr, savings: 0, withdrawals: 0, netSavings: 0, payments: 0 };
      if (type === "savings") existing.savings += item.total;
      else if (type === "withdrawals") existing.withdrawals += item.total;
      else existing.payments += item.total;
      existing.netSavings = existing.savings - existing.withdrawals;
      reportMap.set(dateStr, existing);
    };

    savingsQ.rows.forEach((r) => processItem(r, "savings"));
    withdrawalsQ.rows.forEach((r) => processItem(r, "withdrawals"));
    paymentsQ.rows.forEach((r) => processItem(r, "payments"));

    const report = Array.from(reportMap.values()).sort((a, b) => b.date.localeCompare(a.date));
    return res.json(report.slice(0, 30));
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

app.get("/api/reports/active-loans", async (req, res) => {
  const user = (req as any).user as AppUser;
  const q =
    user.role === "admin"
      ? await pool.query(
          `
          SELECT l.*, m.name as member_name
          FROM loans l
          JOIN members m ON l.member_id = m.id
          WHERE l.status = 'active'
          ORDER BY l.loan_date ASC
        `
        )
      : await pool.query(
          `
          SELECT l.*, m.name as member_name
          FROM loans l
          JOIN members m ON l.member_id = m.id
          WHERE l.status = 'active' AND m.owner_user_id = $1
          ORDER BY l.loan_date ASC
        `,
          [user.id]
        );
  return res.json(q.rows);
});

app.get("/api/schedule/today", async (req, res) => {
  const user = (req as any).user as AppUser;
  const days = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
  const today = days[new Date().getDay()];
  const todayWIB = new Date(Date.now() + 7 * 3600000).toISOString().split("T")[0];

  const q =
    user.role === "admin"
      ? await pool.query(
          `
          SELECT
            m.*,
            l.amount,
            l.total_to_pay,
            l.installment_amount,
            EXISTS(
              SELECT 1
              FROM loan_payments lp
              WHERE lp.loan_id = l.id
                AND (lp.payment_date AT TIME ZONE 'Asia/Jakarta')::date = $1::date
            ) as paid_today
          FROM members m
          JOIN loans l ON m.id = l.member_id
          WHERE m.collection_day = $2 AND l.status = 'active'
          ORDER BY m.name ASC
        `,
          [todayWIB, today]
        )
      : await pool.query(
          `
          SELECT
            m.*,
            l.amount,
            l.total_to_pay,
            l.installment_amount,
            EXISTS(
              SELECT 1
              FROM loan_payments lp
              WHERE lp.loan_id = l.id
                AND (lp.payment_date AT TIME ZONE 'Asia/Jakarta')::date = $1::date
            ) as paid_today
          FROM members m
          JOIN loans l ON m.id = l.member_id
          WHERE m.collection_day = $2 AND l.status = 'active' AND m.owner_user_id = $3
          ORDER BY m.name ASC
        `,
          [todayWIB, today, user.id]
        );

  return res.json(q.rows);
});

app.post("/api/testing/reset-data", requireAdmin, async (_req, res) => {
  const isProduction = process.env.NODE_ENV === "production";
  const allowProdReset = process.env.ALLOW_PROD_RESET === "true";
  if (isProduction && !allowProdReset) {
    return res.status(403).json({
      error: "Endpoint reset nonaktif di production. Set ALLOW_PROD_RESET=true jika owner perlu reset data uji.",
    });
  }
  try {
    await pool.query("BEGIN");
    await pool.query("TRUNCATE TABLE loan_payments, saving_withdrawals, savings, loans, members RESTART IDENTITY CASCADE");
    await pool.query("COMMIT");
    return res.json({
      success: true,
      deleted: { members: "all", loans: "all", savings: "all", withdrawals: "all", loanPayments: "all" },
    });
  } catch (err: any) {
    await pool.query("ROLLBACK");
    return res.status(500).json({ error: err.message });
  }
});

async function start() {
  await initDb();

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static("dist"));
    app.get("*", (_req, res) => {
      res.sendFile(path.resolve("dist/index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

start().catch((err) => {
  console.error("Failed to start server:", err);
  process.exit(1);
});
