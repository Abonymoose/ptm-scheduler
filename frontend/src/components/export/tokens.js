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

// Slot start_time/end_time (and the PTM date) are naive local IST clock
// values merely labelled UTC in the DB -- see CLAUDE.md. `toLocaleTimeString`
// with no explicit timeZone uses the VIEWER's own system zone, which for a
// browser actually set to IST converts a "08:10+00" value to "1:40 PM" --
// wrong, since 08:10 already IS the intended IST wall-clock time. Pinning
// timeZone: 'UTC' here renders the stored digits verbatim, with no
// conversion, regardless of the viewer's own timezone.
export const fmtTime = iso => new Date(iso).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'UTC' })
// Time and AM/PM as separate pieces (mockups render AM/PM as a smaller superscript-style tag).
export const splitTime = iso => {
  const [time, ap] = fmtTime(iso).split(' ')
  return { time, ap: ap || '' }
}
export const fmtDay = iso => new Date(iso).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' })
// UNLIKE the above: this is a genuine current-moment timestamp (when the
// export was produced), not a stored/mislabelled clock value -- it must
// stay in the viewer's actual local time, so no timeZone override here.
export const fmtExportedAt = iso => new Date(iso).toLocaleString('en-IN', { day: 'numeric', month: 'long', year: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true })
