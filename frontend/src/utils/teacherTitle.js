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
  if (/^(Ms\.|Mr\.|Dr\.)/.test(name)) return name
  const title = TITLES[name.trim()] || 'Ms.'
  return `${title} ${name}`
}
