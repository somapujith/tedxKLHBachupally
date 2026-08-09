import { useState } from 'react'
import { Button } from './ui'
import { toCsv, downloadCsv } from './csv'

function DownloadIcon({ className = 'h-3.5 w-3.5' }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className} aria-hidden>
      <path d="M12 3.5v11.5M7.5 11l4.5 4.5L16.5 11" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M4.5 17v2A1.5 1.5 0 0 0 6 20.5h12a1.5 1.5 0 0 0 1.5-1.5v-2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

// Export button + a field-picker popover. `fields` is [{ key, label, value?,
// default? }] — `value` overrides plain `row[key]` for computed columns
// (booleans, joined names), `default: false` starts that column unchecked.
//
// Deliberately client-side only: every caller already has its current
// (filtered, loaded) rows in state, so exporting them is a pure data
// transform, not a new server round trip that could return a different
// snapshot than what's actually on screen.
export default function ExportCsvButton({ rows, fields, filename }) {
  const [open, setOpen] = useState(false)
  const [selected, setSelected] = useState(
    () => new Set(fields.filter((f) => f.default !== false).map((f) => f.key)),
  )
  const allSelected = selected.size === fields.length

  function toggle(key) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  function toggleAll() {
    setSelected(allSelected ? new Set() : new Set(fields.map((f) => f.key)))
  }

  function handleExport() {
    const chosen = fields.filter((f) => selected.has(f.key))
    if (chosen.length === 0) return
    downloadCsv(filename, toCsv(rows, chosen))
    setOpen(false)
  }

  return (
    <div className="relative">
      <Button size="sm" onClick={() => setOpen((v) => !v)} disabled={rows.length === 0}>
        <DownloadIcon />
        Export
      </Button>

      {open && (
        <>
          {/* Click-outside dismiss — a transparent full-screen layer under the
              popover, above everything else. */}
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full z-50 mt-2 w-64 rounded-xl border border-white/10 bg-[#141414] p-3 shadow-2xl">
            <div className="flex items-center justify-between px-1 pb-2">
              <span className="text-xs font-medium text-paper/70">Fields to export</span>
              <button type="button" onClick={toggleAll} className="text-xs text-red hover:underline">
                {allSelected ? 'Clear all' : 'Select all'}
              </button>
            </div>
            <div className="max-h-56 space-y-0.5 overflow-y-auto pr-1">
              {fields.map((f) => (
                <label
                  key={f.key}
                  className="flex cursor-pointer items-center gap-2 rounded-lg px-1.5 py-1.5 text-sm text-paper/80 hover:bg-white/[0.05]"
                >
                  <input
                    type="checkbox"
                    checked={selected.has(f.key)}
                    onChange={() => toggle(f.key)}
                    className="h-3.5 w-3.5 flex-none rounded border-white/20 bg-transparent accent-red"
                  />
                  <span className="truncate">{f.label}</span>
                </label>
              ))}
            </div>
            <Button
              size="sm"
              className="mt-2.5 w-full justify-center"
              onClick={handleExport}
              disabled={selected.size === 0}
            >
              Export {selected.size} field{selected.size === 1 ? '' : 's'} · {rows.length} rows
            </Button>
          </div>
        </>
      )}
    </div>
  )
}
