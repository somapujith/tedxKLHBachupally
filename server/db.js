import { neon } from '@neondatabase/serverless'

export function getSql() {
  const url = process.env.DATABASE_URL
  if (!url) {
    throw new Error('DATABASE_URL is not set')
  }
  return neon(url)
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
}
