// Colour tokens + fonts lifted verbatim from the approved mockups
// (frontend/reference/parent-pass-autofit.html, teacher-pass.html, export-mockups-v6.html).
// Scoped to the export components only -- the rest of the app has no global font-family.
export const T = {
  ink: '#14130E',
  ink2: '#232118',
  body: '#3A3730',
  soft: '#6E6A60',
  faint: '#9C978C',
  hair: '#EDE8DE',
  rule: '#DED8CB',
  paper: '#FFFDF9',
  orange: '#F47920',
}

export const serif = "Fraunces, Georgia, serif"
export const sans = "Inter, -apple-system, sans-serif"

// Same technique the dashboards already use for start_time/end_time -- no
// explicit timeZone, no manual offset math. See CLAUDE.md: converting would
// shift every meeting by 5.5 hours while tests stay green.
export const fmtTime = iso => new Date(iso).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', hour12: true })
// Time and AM/PM as separate pieces (mockups render AM/PM as a smaller superscript-style tag).
export const splitTime = iso => {
  const [time, ap] = fmtTime(iso).split(' ')
  return { time, ap: ap || '' }
}
export const fmtDay = iso => new Date(iso).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })
export const fmtExportedAt = iso => new Date(iso).toLocaleString('en-IN', { day: 'numeric', month: 'long', year: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true })
