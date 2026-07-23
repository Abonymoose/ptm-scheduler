const TITLES = {
  'Sandhya Chhetri': 'Ms.',
  'Helen Gilbert': 'Ms.',
  'Priya Naidu': 'Ms.',
  'Susan Christi': 'Ms.',
  'Anwesha Basu': 'Ms.',
  'Anthony Samuel': 'Mr.',
  'Sunaina Naugain': 'Ms.',
  'Shubha S': 'Ms.',
  'Muneezah Mattu': 'Ms.',
}

export function titleName(name) {
  if (!name) return name
  if (/^(Ms\.|Mrs\.|Mr\.|Dr\.)/.test(name)) return name
  const title = TITLES[name.trim()] || 'Ms.'
  return `${title} ${name}`
}

export const TITLE_OPTIONS = ['Ms.', 'Mrs.', 'Mr.', 'Dr.']
const TITLE_RE = /^(Ms\.|Mrs\.|Mr\.|Dr\.)\s*/i

// Build a stored name string "{title} {name}", but if the name already begins
// with a title, keep it as-is (don't double up).
export function combineTitle(title, name) {
  const trimmed = (name || '').trim()
  if (!trimmed) return trimmed
  if (TITLE_RE.test(trimmed)) return trimmed
  return `${title} ${trimmed}`.trim()
}

// Split a stored name into { title, name } (name = the part after the title) for
// editing. Defaults to Ms. if the name carries no title.
export function splitTitle(fullName) {
  const trimmed = (fullName || '').trim()
  const m = trimmed.match(TITLE_RE)
  if (m) {
    const canonical = TITLE_OPTIONS.find(t => t.toLowerCase() === m[1].toLowerCase()) || m[1]
    return { title: canonical, name: trimmed.slice(m[0].length).trim() }
  }
  return { title: 'Ms.', name: trimmed }
}
