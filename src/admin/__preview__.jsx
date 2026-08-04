// TEMPORARY visual-verification harness. Not imported by the app.
// Mounts the real admin screens against a stubbed adminFetch so the layout can
// be reviewed in a browser without a live DB or a real session.
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import '../index.css'

sessionStorage.setItem('tedx_admin_token', 'preview')
sessionStorage.setItem('tedx_admin_name', 'Pujith Soma')
sessionStorage.setItem('tedx_admin_role', 'superadmin')

const STATS = {
  paid: 184,
  capacity: 250,
  checkedIn: 96,
  pending: 27,
  revenue: 110400,
  byDesignation: [
    { designation: 'student', count: 142 },
    { designation: 'faculty', count: 24 },
    { designation: 'professional', count: 12 },
    { designation: 'alumni', count: 6 },
  ],
  byCollege: [
    { college: 'KL University', count: 98 },
    { college: 'Bachupally Institute of Technology', count: 41 },
    { college: 'Osmania University', count: 28 },
    { college: 'Other', count: 17 },
  ],
}

const REGS = Array.from({ length: 6 }, (_, i) => ({
  id: `r${i}`,
  full_name: ['Aarav Menon', 'Diya Reddy', 'Kabir Shah', 'Ishita Rao', 'Vivaan Kapoor', 'Ananya Nair'][i],
  email: `attendee${i}@example.com`,
  phone: `98765432${10 + i}`,
  college: ['KL University', 'Osmania University', 'BIT Bachupally'][i % 3],
  designation: ['student', 'faculty', 'professional'][i % 3],
  payment_status: ['paid', 'pending', 'checked_in'][i % 3],
  paid_at: '2026-07-30T10:12:00Z',
  checked_in_at: i % 3 === 2 ? '2026-08-04T04:02:00Z' : null,
  checked_in_by: i % 3 === 2 ? 'Gate 1' : null,
  ticket_issued: i % 3 !== 1,
  utr_id: 'UTR90881726351',
  amount: 600,
}))

const TICKETS = [
  {
    id: 't1',
    full_name: 'Rhea Iyer',
    email: 'rhea@example.com',
    phone: '9876543299',
    subject: 'Did not receive pass',
    message: 'I paid yesterday evening and the amount was debited, but no email arrived. Checked spam too.',
    status: 'open',
    created_at: '2026-08-03T18:20:00Z',
    payment_status: 'paid',
    registration_id: 'r1',
  },
  {
    id: 't2',
    full_name: 'Mohit Bansal',
    email: 'mohit@example.com',
    phone: '9876543288',
    subject: 'Wrong name on pass',
    message: 'My name is spelled incorrectly on the QR pass.',
    status: 'resolved',
    created_at: '2026-08-02T09:00:00Z',
    resolved_at: '2026-08-02T11:30:00Z',
    resolved_by: 'Pujith',
    admin_note: 'Reissued with corrected name.',
    payment_status: 'checked_in',
    registration_id: 'r2',
  },
]

const ROUTES = {
  '/api/admin/stats': { stats: STATS },
  '/api/admin/super-stats': {
    superStats: {
      byAdmin: [
        { admin: 'Pujith Soma', scans: 54 },
        { admin: 'Gate 1', scans: 31 },
        { admin: 'Gate 2', scans: 11 },
      ],
      emailByStatus: [
        { status: 'sent', count: 181 },
        { status: 'failed', count: 2 },
        { status: 'skipped', count: 1 },
      ],
      emailByTrigger: [
        { triggered_by: 'system', count: 170 },
        { triggered_by: 'Pujith Soma', count: 11 },
      ],
      failedLogins24h: 3,
      actionsLastHour: 42,
    },
  },
  '/api/admin/settings': {
    settings: { seatCapacity: 250, overridden: true, updatedBy: 'Pujith Soma', fallbackCapacity: 200, paid: 184 },
  },
  '/api/admin/verifications': { registrations: REGS.slice(0, 3) },
  '/api/admin/support': { tickets: TICKETS, openCount: 1 },
  '/api/admin/registrations': { registrations: REGS },
  '/api/admin/admins': {
    admins: [
      { id: 'a1', username: 'pujith', display_name: 'Pujith Soma', role: 'superadmin', is_active: true, scans: 54, last_login_at: '2026-08-04T08:00:00Z' },
      { id: 'a2', username: 'gate1', display_name: 'Gate 1', role: 'admin', is_active: true, scans: 31, last_login_at: '2026-08-03T17:00:00Z' },
      { id: 'a3', username: 'gate2', display_name: 'Gate 2', role: 'admin', is_active: false, scans: 11, last_login_at: null },
    ],
  },
  '/api/admin/audit-log': {
    entries: [
      { id: 1, action: 'checkin_success', admin_username: 'gate1', admin_role: 'admin', target_name: 'Aarav Menon', target_type: 'registration', created_at: '2026-08-04T04:02:00Z', ip: '10.0.0.4', result: 'success' },
      { id: 2, action: 'login_failed', admin_username: 'unknown', admin_role: 'admin', created_at: '2026-08-04T03:40:00Z', ip: '10.0.0.9', result: 'failure', detail: 'bad password' },
      { id: 3, action: 'capacity_updated', admin_username: 'pujith', admin_role: 'superadmin', created_at: '2026-08-03T20:10:00Z', ip: '10.0.0.2', result: 'success', detail: '200 -> 250' },
    ],
  },
  '/api/admin/email-log': {
    entries: [
      { id: 1, status: 'sent', full_name: 'Aarav Menon', to_email: 'attendee0@example.com', triggered_by: 'system', provider_message_id: 'msg_8812', created_at: '2026-07-30T10:13:00Z' },
      { id: 2, status: 'failed', full_name: 'Diya Reddy', to_email: 'attendee1@example.com', triggered_by: 'Pujith Soma', error: 'mailbox full', created_at: '2026-07-30T11:00:00Z' },
    ],
  },
}

// Intercept fetch instead of patching the api module, so api.js runs unmodified.
const realFetch = window.fetch.bind(window)
window.fetch = async (input, init) => {
  const url = typeof input === 'string' ? input : input?.url ?? ''
  const path = url.split('?')[0].replace(/^https?:\/\/[^/]+/, '')
  if (path.startsWith('/api/admin')) {
    const body = ROUTES[path] ?? {}
    return new Response(JSON.stringify({ ok: true, ...body }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  }
  return realFetch(input, init)
}

const { default: AdminShell } = await import('./AdminShell.jsx')
const { default: AdminDashboard } = await import('./AdminDashboard.jsx')
const { default: AdminRegistrations } = await import('./AdminRegistrations.jsx')
const { default: AdminSupport } = await import('./AdminSupport.jsx')
const { default: AdminAdmins } = await import('./AdminAdmins.jsx')
const { default: AdminActivity } = await import('./AdminActivity.jsx')

const start = new URLSearchParams(location.search).get('at') || '/admin'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <MemoryRouter initialEntries={[start]}>
      <Routes>
        <Route path="/admin" element={<AdminShell />}>
          <Route index element={<AdminDashboard />} />
          <Route path="registrations" element={<AdminRegistrations />} />
          <Route path="support" element={<AdminSupport />} />
          <Route path="admins" element={<AdminAdmins />} />
          <Route path="activity" element={<AdminActivity />} />
        </Route>
      </Routes>
    </MemoryRouter>
  </StrictMode>,
)
