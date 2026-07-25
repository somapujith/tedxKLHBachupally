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
  await sql`
    CREATE INDEX IF NOT EXISTS registrations_order_idx
    ON registrations (razorpay_order_id)
  `
}
