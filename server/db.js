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
  // One email may hold several registrations (a parent buying for two children,
  // or a paid attendee returning for another seat), so email is NOT unique. The
  // old index is dropped rather than merely no longer created: it exists on
  // every database provisioned before this change and would keep rejecting the
  // second registration for an address regardless of what the application
  // allows. A plain index remains — the lookups still need it.
  await sql`DROP INDEX IF EXISTS registrations_email_unique`
  await sql`
    CREATE INDEX IF NOT EXISTS registrations_email_idx
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
  // Manual bank-transfer flow. The buyer pays into the bank QR out-of-band, then
  // submits the UTR reference and a screenshot of the transaction; an admin
  // eyeballs both against the bank statement and approves. payment_status moves
  // pending -> submitted -> paid (or rejected, which the buyer can resubmit from).
  //
  // The proof is stored inline as base64 rather than in object storage: this
  // deployment has no blob provider, and a per-row image keeps the admin read a
  // single query. It is NEVER selected by list/stats queries — only by the
  // single-row proof fetch — so the wide column cannot bloat the hot paths.
  await sql`ALTER TABLE registrations ADD COLUMN IF NOT EXISTS utr_id TEXT`
  await sql`ALTER TABLE registrations ADD COLUMN IF NOT EXISTS payment_proof TEXT`
  await sql`ALTER TABLE registrations ADD COLUMN IF NOT EXISTS proof_mime TEXT`
  await sql`ALTER TABLE registrations ADD COLUMN IF NOT EXISTS submitted_at TIMESTAMPTZ`
  await sql`ALTER TABLE registrations ADD COLUMN IF NOT EXISTS verified_at TIMESTAMPTZ`
  await sql`ALTER TABLE registrations ADD COLUMN IF NOT EXISTS verified_by TEXT`
  await sql`ALTER TABLE registrations ADD COLUMN IF NOT EXISTS rejected_reason TEXT`
  // Coupon applied at submit time. The code is denormalized alongside the id so
  // the admin verification queue can show "₹449 − ₹100 = ₹349, coupon SAVE100"
  // without a join, and so the record survives the coupon being deleted — an
  // admin checking a bank statement months later still needs to know why the
  // transfer was short.
  await sql`ALTER TABLE registrations ADD COLUMN IF NOT EXISTS coupon_id UUID`
  await sql`ALTER TABLE registrations ADD COLUMN IF NOT EXISTS coupon_code TEXT`
  await sql`ALTER TABLE registrations ADD COLUMN IF NOT EXISTS discount_amount INTEGER`
  // Drives the admin verification queue (oldest submission first).
  await sql`
    CREATE INDEX IF NOT EXISTS registrations_submitted_idx
    ON registrations (submitted_at)
    WHERE payment_status = 'submitted'
  `
  // A UTR is a bank-unique reference: the same one appearing twice means either a
  // duplicate submission or someone copying another buyer's reference. Enforced
  // here so the race between two concurrent submits cannot land both.
  await sql`
    CREATE UNIQUE INDEX IF NOT EXISTS registrations_utr_unique
    ON registrations (utr_id)
    WHERE utr_id IS NOT NULL
  `
  await sql`
    CREATE INDEX IF NOT EXISTS registrations_order_idx
    ON registrations (razorpay_order_id)
  `
  // Legacy from the removed card gateway; kept so historical paid rows keep their
  // reference. Each order id was minted per-registration, so it is already unique in
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

// Support requests raised by an attendee after registering — "my QR never
// arrived", "I paid twice", "wrong email on the pass". registration_id is the
// row they raised it from, kept nullable and WITHOUT a foreign key on purpose:
// a ticket must survive the registration being deleted, since the deletion is
// often the very thing being complained about. name/phone/email are copied in
// at write time for the same reason — the admin needs a way to call the person
// back that does not depend on the referenced row still existing.
export async function ensureSupportTicketsTable(sql = getSql()) {
  await sql`
    CREATE TABLE IF NOT EXISTS support_tickets (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      registration_id UUID,
      full_name TEXT,
      phone TEXT NOT NULL,
      email TEXT NOT NULL,
      subject TEXT,
      message TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'open',
      resolved_at TIMESTAMPTZ,
      resolved_by TEXT,
      admin_note TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `
  // Drives the admin queue: open tickets first, oldest first within each status.
  await sql`
    CREATE INDEX IF NOT EXISTS support_tickets_open_idx
    ON support_tickets (created_at ASC)
    WHERE status = 'open'
  `
  await sql`
    CREATE INDEX IF NOT EXISTS support_tickets_created_idx
    ON support_tickets (created_at DESC)
  `
  // Per-email throttle reads this (see server/support.js).
  await sql`
    CREATE INDEX IF NOT EXISTS support_tickets_email_idx
    ON support_tickets (LOWER(email), created_at DESC)
  `
  await sql`
    DO $$
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'support_tickets_status_check') THEN
        ALTER TABLE support_tickets ADD CONSTRAINT support_tickets_status_check
          CHECK (status IN ('open', 'resolved'));
      END IF;
    END $$
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
// Discount coupons and their redemptions.
//
// Two tables rather than a `times_used` counter on the coupon: a counter is a
// derived number that drifts the moment a registration is deleted, refunded, or
// rolled back, and it invites a lost-update race between two concurrent
// redemptions. The count the admin screen shows is a COUNT(*) over facts.
//
// A redemption is recorded at payment-submit time and keyed uniquely on
// registration_id, so a buyer who resubmits their proof (allowed from
// pending/rejected) updates their existing row instead of inflating the count.
export async function ensureCouponsTable(sql = getSql()) {
  await sql`
    CREATE TABLE IF NOT EXISTS coupons (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      code TEXT NOT NULL,
      discount_amount INTEGER NOT NULL,
      is_active BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      created_by TEXT,
      updated_at TIMESTAMPTZ
    )
  `
  // Codes are matched case-insensitively (buyers type them by hand, often in
  // lowercase), so uniqueness has to be enforced on the same expression the
  // lookup uses — a plain UNIQUE(code) would happily accept both SAVE100 and
  // save100 and then resolve the buyer's input to whichever row Postgres found
  // first.
  await sql`
    CREATE UNIQUE INDEX IF NOT EXISTS coupons_code_unique
    ON coupons (UPPER(code))
  `
  await sql`
    CREATE TABLE IF NOT EXISTS coupon_redemptions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      coupon_id UUID NOT NULL REFERENCES coupons(id) ON DELETE CASCADE,
      registration_id UUID NOT NULL,
      discount_amount INTEGER NOT NULL,
      amount_paid INTEGER NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `
  // One redemption row per registration, so a resubmitted proof cannot be
  // counted twice. ON CONFLICT in recordRedemption targets this index.
  await sql`
    CREATE UNIQUE INDEX IF NOT EXISTS coupon_redemptions_registration_unique
    ON coupon_redemptions (registration_id)
  `
  await sql`
    CREATE INDEX IF NOT EXISTS coupon_redemptions_coupon_idx
    ON coupon_redemptions (coupon_id)
  `
}

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
