import { neon } from '@neondatabase/serverless'

// `registrations.id` is a uuid column, so Postgres rejects any non-uuid value with
// a 22P02 invalid_text_representation error rather than simply matching no rows.
// Callers that take an id straight off a request body must therefore check the
// shape BEFORE querying: without this, a client sending `id: "abc"` (a stale or
// tampered value, or a scripted probe) turns a plain "not found" into a thrown
// driver error — surfacing as a 500 and logging a Postgres stack on every hit.
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
export function isUuid(value) {
  return typeof value === 'string' && UUID_RE.test(value)
}

// A single neon() client per cold start. The Neon serverless driver talks to the
// DB over stateless HTTP (no persistent TCP pool), so this is safe to reuse and
// avoids re-parsing the connection string on every query. Under a 500-user burst
// each function instance reuses one client instead of minting one per request.
let sqlClient = null
export function getSql() {
  if (sqlClient) return sqlClient
  const url = process.env.DATABASE_URL
  if (!url) {
    throw new Error('DATABASE_URL is not set')
  }
  sqlClient = neon(url)
  return sqlClient
}

// Retry a transient DB operation with capped exponential backoff. Neon's HTTP
// endpoint can briefly 5xx / reset a connection during autoscaling or a cold
// branch; a burst of 500 users makes that far more likely to be hit by someone.
// Only network/5xx-shaped errors are retried — a constraint violation (e.g. a
// duplicate email, code 23505) is deterministic and must surface immediately.
// Node network error codes that are unambiguously transient.
const TRANSIENT_CODES = new Set(['ECONNRESET', 'ETIMEDOUT', 'EAI_AGAIN', 'ECONNREFUSED', 'EPIPE'])

// A DB error is only treated as transient (retriable) when it is clearly a
// connection/transport failure — NOT when its message merely happens to contain
// a substring like "connection" or "503". A Postgres SQLSTATE is present on real
// query errors (e.g. 23505 unique_violation); those are deterministic and must
// surface immediately, never retried. So: retry on a known network code, or on a
// transport-shaped message, but bail the moment a 5-char SQLSTATE code is present.
function isTransientDbError(err) {
  const code = String(err?.code || '')
  if (/^[0-9A-Z]{5}$/.test(code)) return false // a Postgres SQLSTATE => deterministic
  if (TRANSIENT_CODES.has(code)) return true
  const msg = String(err?.message || '')
  return /\bfetch failed\b|\bconnection (?:reset|refused|closed|terminated)\b|\bnetwork\b|\bsocket hang up\b|\btimed? ?out\b/i.test(
    msg,
  )
}

export async function withDbRetry(fn, { retries = 2, baseMs = 120 } = {}) {
  let lastErr
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn()
    } catch (err) {
      lastErr = err
      if (!isTransientDbError(err) || attempt === retries) throw err
      await sleep(baseMs * 2 ** attempt)
    }
  }
  throw lastErr
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export async function ensureRegistrationsTable(sql = getSql()) {
  await sql`
    CREATE TABLE IF NOT EXISTS registrations (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      full_name TEXT NOT NULL,
      phone TEXT NOT NULL,
      email TEXT NOT NULL,
      designation TEXT NOT NULL CHECK (designation IN ('student', 'staff', 'guest')),
      college TEXT,
      college_other TEXT,
      payment_status TEXT NOT NULL DEFAULT 'pending',
      amount INTEGER,
      razorpay_order_id TEXT,
      razorpay_payment_id TEXT,
      paid_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `
  await sql`
    CREATE UNIQUE INDEX IF NOT EXISTS registrations_email_unique
    ON registrations (LOWER(email))
  `
  // Columns for pre-existing tables (idempotent).
  await sql`ALTER TABLE registrations ADD COLUMN IF NOT EXISTS amount INTEGER`
  await sql`ALTER TABLE registrations ADD COLUMN IF NOT EXISTS razorpay_order_id TEXT`
  await sql`ALTER TABLE registrations ADD COLUMN IF NOT EXISTS razorpay_payment_id TEXT`
  await sql`ALTER TABLE registrations ADD COLUMN IF NOT EXISTS paid_at TIMESTAMPTZ`
  await sql`ALTER TABLE registrations ADD COLUMN IF NOT EXISTS ticket_jti TEXT`
  await sql`ALTER TABLE registrations ADD COLUMN IF NOT EXISTS ticket_issued_at TIMESTAMPTZ`
  await sql`ALTER TABLE registrations ADD COLUMN IF NOT EXISTS ticket_email_sent_at TIMESTAMPTZ`
  // Revocation must be a STATE, not the absence of a jti. Clearing ticket_jti
  // alone returns the row to "paid, never issued", which every idempotent
  // re-issue path (a replayed payment/verify, a plain admin's Resend) reads as
  // an invitation to mint a fresh pass — silently undoing the revoke. This
  // stamp is what makes a revoke stick until a superadmin lifts it.
  await sql`ALTER TABLE registrations ADD COLUMN IF NOT EXISTS ticket_revoked_at TIMESTAMPTZ`
  await sql`ALTER TABLE registrations ADD COLUMN IF NOT EXISTS checked_in_at TIMESTAMPTZ`
  await sql`ALTER TABLE registrations ADD COLUMN IF NOT EXISTS checked_in_by TEXT`
  await sql`
    CREATE INDEX IF NOT EXISTS registrations_order_idx
    ON registrations (razorpay_order_id)
  `
  // Each Razorpay order id is minted per-registration, so it is already unique in
  // practice; this partial unique index enforces it (NULLs excluded — pending rows
  // have no order id yet) and lets settlePayment's per-order flip stay unambiguous.
  await sql`
    CREATE UNIQUE INDEX IF NOT EXISTS registrations_order_unique
    ON registrations (razorpay_order_id)
    WHERE razorpay_order_id IS NOT NULL
  `
}

export async function ensureContactMessagesTable(sql = getSql()) {
  await sql`
    CREATE TABLE IF NOT EXISTS contact_messages (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name TEXT NOT NULL,
      email TEXT NOT NULL,
      phone TEXT,
      subject TEXT,
      message TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `
  await sql`
    CREATE INDEX IF NOT EXISTS contact_messages_created_idx
    ON contact_messages (created_at DESC)
  `
}

export async function ensureAdminsTable(sql = getSql()) {
  await sql`
    CREATE TABLE IF NOT EXISTS admins (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      username TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      display_name TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `
  await sql`
    CREATE UNIQUE INDEX IF NOT EXISTS admins_username_unique
    ON admins (LOWER(username))
  `
  // Role gate. Defaults to 'admin' so every pre-existing row keeps exactly the
  // access it had; 'superadmin' is additive (audit log, email log, admin
  // management) and is only ever granted explicitly.
  await sql`ALTER TABLE admins ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'admin'`
  // Deactivation instead of deletion, so an admin who scanned attendees keeps a
  // resolvable identity in the audit trail after they lose access.
  await sql`ALTER TABLE admins ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE`
  await sql`ALTER TABLE admins ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ`
  await sql`ALTER TABLE admins ADD COLUMN IF NOT EXISTS created_by TEXT`
  // Added separately from the column so a table that already has the column
  // still gets the constraint. The column default keeps existing rows valid.
  await sql`
    DO $$
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'admins_role_check') THEN
        ALTER TABLE admins ADD CONSTRAINT admins_role_check
          CHECK (role IN ('admin', 'superadmin'));
      END IF;
    END $$
  `
}

// Runtime-editable event settings (currently just the seat-capacity override).
// One row per key; value stored as TEXT and validated by the reader, so a bad
// hand-written row degrades to the env/default capacity instead of throwing a
// cast error inside the payment path.
export async function ensureSettingsTable(sql = getSql()) {
  await sql`
    CREATE TABLE IF NOT EXISTS app_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_by TEXT
    )
  `
}

// Append-only record of every privileged action. Deliberately denormalised —
// admin_username and target_name are copied in at write time so the trail still
// reads correctly after an admin is renamed or a registration is removed.
export async function ensureAuditLogTable(sql = getSql()) {
  await sql`
    CREATE TABLE IF NOT EXISTS admin_audit_log (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      admin_id UUID,
      admin_username TEXT NOT NULL,
      admin_role TEXT,
      action TEXT NOT NULL,
      result TEXT NOT NULL DEFAULT 'success',
      target_type TEXT,
      target_id TEXT,
      target_name TEXT,
      detail TEXT,
      ip TEXT,
      user_agent TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `
  await sql`
    CREATE INDEX IF NOT EXISTS admin_audit_log_created_idx
    ON admin_audit_log (created_at DESC)
  `
  await sql`
    CREATE INDEX IF NOT EXISTS admin_audit_log_admin_idx
    ON admin_audit_log (LOWER(admin_username), created_at DESC)
  `
  await sql`
    CREATE INDEX IF NOT EXISTS admin_audit_log_action_idx
    ON admin_audit_log (action, created_at DESC)
  `
}

// Every outbound ticket email — sent, failed or skipped — with who triggered it.
// registrations.ticket_email_sent_at only holds the LAST successful send; this
// keeps the full history, including the failures that column rolls back to NULL.
export async function ensureEmailLogTable(sql = getSql()) {
  await sql`
    CREATE TABLE IF NOT EXISTS email_log (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      registration_id UUID,
      to_email TEXT NOT NULL,
      full_name TEXT,
      email_type TEXT NOT NULL DEFAULT 'ticket',
      status TEXT NOT NULL,
      provider_message_id TEXT,
      error TEXT,
      triggered_by TEXT NOT NULL DEFAULT 'system',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `
  await sql`
    CREATE INDEX IF NOT EXISTS email_log_created_idx
    ON email_log (created_at DESC)
  `
  await sql`
    CREATE INDEX IF NOT EXISTS email_log_registration_idx
    ON email_log (registration_id, created_at DESC)
  `
  await sql`
    CREATE INDEX IF NOT EXISTS email_log_status_idx
    ON email_log (status, created_at DESC)
  `
}

// Ensure the registrations schema AT MOST ONCE per cold start. The DDL is
// idempotent (all CREATE ... IF NOT EXISTS), but it is ~15 round-trips; running
// it on every /register and /payment/order request was pure waste and, under a
// 500-user burst, real added DB load and latency. The promise is memoized so a
// concurrent burst on a fresh instance shares one ensure, and a failed attempt
// is NOT cached (reset to null) so the next request can retry.
let schemaReady = null
export function ensureSchemaOnce(sql = getSql()) {
  if (schemaReady) return schemaReady
  // Admins is included so a deploy that never ran db:migrate still self-heals:
  // loginAdmin selects the role/is_active columns directly, and without this a
  // pre-existing admins table would 42703 every login until someone migrated.
  // Health pings call this constantly, but the promise is memoized — the DDL
  // still runs once per cold start.
  schemaReady = Promise.all([ensureRegistrationsTable(sql), ensureAdminsTable(sql)]).catch(
    (err) => {
      schemaReady = null
      throw err
    },
  )
  return schemaReady
}
