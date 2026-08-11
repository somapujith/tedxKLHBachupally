import { useEffect, useRef, useState } from 'react'
import { contact } from '../data/site'
import instagramIcon from '../assets/images/instagram.svg'

// Follow-us prompt, five seconds after the site opens.
//
// On why this is a link and not an embedded profile: instagram.com refuses to
// be framed (X-Frame-Options / frame-ancestors), and the old follow-button
// widget is long gone — only individual posts have an embed endpoint, and those
// carry no Follow control. So the CTA is a plain link to the profile. That is
// not a downgrade on the platform that matters: on iOS and Android an
// instagram.com/<user> URL is a universal link, so tapping it hands off to the
// installed app and lands on the profile with Follow one tap away. Desktop gets
// the web profile. A custom instagram:// scheme was deliberately not used — it
// dead-ends with an error page when the app is absent, which is most desktops.

const DISMISS_KEY = 'tedx_ig_prompt_dismissed_at'
const SHOW_AFTER_MS = 5000
// Once a fortnight per browser. A prompt that reappears every visit reads as a
// popup ad and costs more goodwill than the follows it wins.
const REMIND_AFTER_MS = 14 * 24 * 60 * 60 * 1000

function recentlyDismissed() {
  try {
    const at = Number(window.localStorage.getItem(DISMISS_KEY))
    return Boolean(at) && Date.now() - at < REMIND_AFTER_MS
  } catch {
    // Safari private mode throws on localStorage. Showing the prompt is the
    // safer failure: it is dismissible, whereas a thrown error is not.
    return false
  }
}

function remember() {
  try {
    window.localStorage.setItem(DISMISS_KEY, String(Date.now()))
  } catch {
    /* nothing to do — the prompt simply returns next visit */
  }
}

export default function InstagramModal() {
  const [open, setOpen] = useState(false)
  const closeRef = useRef(null)
  const followRef = useRef(null)
  const restoreFocusTo = useRef(null)

  useEffect(() => {
    if (recentlyDismissed()) return
    const timer = setTimeout(() => setOpen(true), SHOW_AFTER_MS)
    return () => clearTimeout(timer)
  }, [])

  // Escape closes, and Tab is trapped between the two focusable controls so a
  // keyboard user cannot tab into the page behind an open dialog.
  useEffect(() => {
    if (!open) return

    restoreFocusTo.current = document.activeElement
    followRef.current?.focus()

    function onKeyDown(e) {
      if (e.key === 'Escape') {
        dismiss()
        return
      }
      if (e.key !== 'Tab') return
      const focusable = [followRef.current, closeRef.current].filter(Boolean)
      if (focusable.length < 2) return
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', onKeyDown)
    // The page behind a modal must not scroll under it.
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.body.style.overflow = previousOverflow
    }
  }, [open])

  function dismiss() {
    remember()
    setOpen(false)
    // Put focus back where it was, so a keyboard user is not dropped at the top
    // of the document.
    if (restoreFocusTo.current instanceof HTMLElement) restoreFocusTo.current.focus()
  }

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-5"
      role="presentation"
      onClick={(e) => {
        // Backdrop only — a click inside the card must not close it.
        if (e.target === e.currentTarget) dismiss()
      }}
    >
      {/* Transparent backdrop: the site stays visible through it, dimmed just
          enough to push the card forward. */}
      <div
        aria-hidden
        className="absolute inset-0 bg-ink/50 backdrop-blur-sm motion-safe:animate-[fadeIn_200ms_ease-out]"
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="ig-prompt-title"
        aria-describedby="ig-prompt-body"
        className="relative w-full max-w-sm overflow-hidden rounded-2xl border border-paper/12 bg-ink/85 p-7 text-center shadow-2xl backdrop-blur-xl motion-safe:animate-[popIn_260ms_cubic-bezier(0.16,1,0.3,1)]"
      >
        <button
          ref={closeRef}
          type="button"
          onClick={dismiss}
          aria-label="Close"
          className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full text-paper/50 transition-colors hover:bg-paper/10 hover:text-paper focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red focus-visible:ring-offset-2 focus-visible:ring-offset-ink motion-reduce:transition-none"
        >
          <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
            <path d="M5 5l10 10M15 5L5 15" strokeLinecap="round" />
          </svg>
        </button>

        <span className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl border border-paper/12 bg-paper/[0.06]">
          <img src={instagramIcon} alt="" aria-hidden="true" className="h-7 w-7" />
        </span>

        <h2 id="ig-prompt-title" className="font-display text-2xl leading-tight tracking-tight text-paper">
          Follow us for new <span className="text-red">speaker updates</span>
        </h2>

        <p id="ig-prompt-body" className="mt-3 text-sm leading-relaxed text-paper/70">
          Every speaker reveal, stage announcement and behind-the-scenes moment goes
          out on Instagram first. Please follow us so you do not miss one.
        </p>

        <a
          ref={followRef}
          href={contact.instagram}
          target="_blank"
          rel="noopener noreferrer"
          onClick={dismiss}
          className="mt-6 flex w-full items-center justify-center gap-2 rounded-full bg-red px-6 py-3.5 text-sm font-semibold tracking-wide text-paper transition hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red focus-visible:ring-offset-2 focus-visible:ring-offset-ink motion-reduce:transition-none"
        >
          Follow {contact.instagramHandle}
        </a>

        <button
          type="button"
          onClick={dismiss}
          className="mt-3 w-full py-2 text-xs tracking-wide text-paper/45 transition-colors hover:text-paper/70 motion-reduce:transition-none"
        >
          Maybe later
        </button>
      </div>
    </div>
  )
}
