# Mobile-native admin panel — design

**Date:** 2026-07-27
**Branch:** feat/razorpay-payment

## Goal

Make the TEDxKLH admin panel feel like a native mobile app on phones: a fixed
bottom nav bar with the QR **Scan** action pinned to a raised center button for
one-tap access from anywhere, and card-based lists instead of horizontal-scroll
tables. Desktop (≥768px) keeps the existing wide table/grid layout.

## Decisions

- **Scope:** Full mobile shell + bottom nav wrapping all admin screens.
- **Nav:** 3 items — Dashboard · **SCAN** (raised center) · Registrations.
  Logout + admin name move to a top-right bar. No backend changes.
- **Responsive:** mobile shell (bottom nav + cards) below `md` (768px); at `md+`
  the current wide table/grid and top header links return. Single codebase,
  breakpoint-driven.
- **Screen split:** the current single Dashboard is split into two focused
  screens — Dashboard (stats + breakdowns) and Registrations (searchable list).

## Architecture

```
src/admin/
  AdminShell.jsx          NEW  layout: top bar (name + logout) + <Outlet/> + <BottomNav/>
  BottomNav.jsx           NEW  fixed bottom, 3 slots, raised center SCAN, active highlight, md:hidden
  AdminDashboard.jsx      EDIT stats + breakdowns only; registrations extracted out
  AdminRegistrations.jsx  NEW  search + attendee cards (mobile) / existing table (md+)
  AdminScan.jsx           EDIT full-screen immersive; unchanged camera/manual logic; back → Dashboard
  AdminLogin.jsx          unchanged (rendered bare, no shell)
  api.js                  unchanged
```

### Routing (src/App.jsx)

```
/admin/login          → AdminLogin      (bare)
/admin/scan           → AdminScan       (bare, full-screen — bottom nav hidden for immersion)
<AdminShell> (element route):
  /admin               → AdminDashboard        (index)
  /admin/registrations → AdminRegistrations
```

Shell owns the bottom nav; scan and login live outside the shell so the scanner
stays immersive and login has no chrome.

### Bottom nav

- Fixed to viewport bottom, `pb-[env(safe-area-inset-bottom)]` for the iPhone
  home indicator, `md:hidden`.
- 3 slots: Dashboard (left) · **SCAN** raised red circular FAB (center,
  `-translate-y`) · Registrations (right).
- Active route → red accent (`text-red`); inactive → `text-paper/55`.
- Uses `react-router` `NavLink`/`useLocation` for active state.

### Registrations screen

- **Mobile:** filter chips (All/Paid/Pending/Checked-in) as a horizontal
  scroller; search input (name/email/phone); one card per attendee showing
  name, college, status badge, tap-to-call phone (`tel:`), and a Resend-pass
  button. Card expands for check-in details.
- **Desktop (md+):** reuse the existing `RegistrationsTable` markup.
- Search filters client-side over the already-fetched rows.

### Data flow

Unchanged. Same `adminFetch` calls to `/api/admin/stats`,
`/api/admin/registrations`, `/api/admin/checkin`, `/api/admin/resend-ticket`.
Dashboard fetches stats; Registrations fetches the list — two lighter loads
instead of one combined fetch. Auth guard (`getToken()` → redirect to
`/admin/login`) preserved per screen. 30s auto-refresh preserved on each.

## Error handling / edge cases

- Logout asks for confirm.
- Missing token on any shell screen → redirect to login.
- Scanner immersive: bottom nav not rendered on `/admin/scan`; existing camera
  permission + manual-token fallback untouched.
- Safe-area padding so nav is not hidden behind the iPhone home bar.
- Empty/loading states preserved on both split screens.

## Testing / verification

- No API change → existing 75 server tests unaffected.
- `npm run build` green; new files bundled.
- Manual: routes resolve; Scan reachable in one tap from Dashboard AND
  Registrations; active nav highlight correct; desktop still shows wide table;
  safe-area padding present.

## Out of scope

- No new endpoints, auth changes, or DB changes.
- No changes to public site or Login screen.
