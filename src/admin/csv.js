// Client-side CSV export. No new server endpoint: every admin list screen
// already has its current (filtered, loaded) rows in state, and that's
// exactly what "export what I'm looking at" means — a separate server round
// trip would risk exporting a different snapshot than what's on screen.

function escapeCell(value) {
  const s = value === null || value === undefined ? '' : String(value)
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

export function toCsv(rows, fields) {
  const header = fields.map((f) => escapeCell(f.label)).join(',')
  const lines = rows.map((row) =>
    fields
      .map((f) => escapeCell(typeof f.value === 'function' ? f.value(row) : row[f.key]))
      .join(','),
  )
  return [header, ...lines].join('\r\n')
}

export function downloadCsv(filename, csvString) {
  // Leading BOM so Excel opens it as UTF-8 instead of guessing Latin-1 and
  // mangling any non-ASCII character in a name.
  const blob = new Blob(['﻿' + csvString], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}
