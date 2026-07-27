// Format a school's PTM date (ISO 'YYYY-MM-DD') as "DD Mon YYYY", e.g. "09 Apr 2026".
// Parsed as a plain calendar date (no timezone shift). Falls back to a sensible
// default while /auth/me is still loading.
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

export const DEFAULT_PTM_DATE = '2026-04-09'

export function formatPtmDate(iso) {
  const s = iso || DEFAULT_PTM_DATE
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s)
  if (!m) return s
  const [, y, mo, d] = m
  return `${d} ${MONTHS[parseInt(mo, 10) - 1]} ${y}`
}
