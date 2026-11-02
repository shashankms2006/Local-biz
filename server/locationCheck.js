// Flags results whose address or location looks doubtful, so a human can verify them.
// Map data for small businesses is sometimes wrong; we cannot fix the source, but we can
// say why a row looks doubtful so it can be checked before contacting the business.

// Common alternative spellings of Indian city names (listings may use either form).
const ALIAS_GROUPS = [
  ['bengaluru', 'bangalore', 'bengalooru'], ['mysuru', 'mysore'], ['shivamogga', 'shimoga'],
  ['mangaluru', 'mangalore'], ['hubballi', 'hubli', 'hubli dharwad'], ['belagavi', 'belgaum'],
  ['kalaburagi', 'gulbarga'], ['vijayapura', 'bijapur'], ['tumakuru', 'tumkur'], ['ballari', 'bellary'],
  ['chikkamagaluru', 'chikmagalur', 'chikkamagalur'], ['davanagere', 'davangere'],
  ['mumbai', 'bombay'], ['kolkata', 'calcutta'], ['chennai', 'madras'], ['pune', 'poona'],
  ['thiruvananthapuram', 'trivandrum'], ['kochi', 'cochin'], ['gurugram', 'gurgaon'],
  ['vadodara', 'baroda'], ['varanasi', 'benares', 'banaras'], ['puducherry', 'pondicherry'],
  ['prayagraj', 'allahabad'], ['kozhikode', 'calicut'], ['visakhapatnam', 'vizag'],
]

const norm = (s) => String(s || '').toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, ' ').trim()

/** Tokens that identify the searched place, including known alternative spellings. */
export function placeTokens(label) {
  const segs = String(label || '').split(',').map(norm).filter(Boolean).slice(0, 2)
  const out = new Set(segs)
  for (const s of segs) for (const g of ALIAS_GROUPS) if (g.includes(s)) g.forEach((a) => out.add(a))
  return [...out].filter((t) => t.length >= 3)
}

const LOCALITY_FIELDS = ['municipality', 'localName', 'municipalitySubdivision', 'municipalitySecondarySubdivision',
  'neighbourhood', 'countrySecondarySubdivision', 'countryTertiarySubdivision']

/**
 * Returns { level: 'ok' | 'check', reasons: [...strong], notes: [...weak] }.
 * 'check' means "verify this location before contacting the business".
 */
export function assessLocation(r, { place, geoMatch } = {}) {
  const addr = r.address || {}
  const reasons = []
  const notes = []

  if (!addr.freeformAddress) reasons.push('No address is listed for this business.')

  if (geoMatch === 'approximate') {
    reasons.push('Not confirmed to be inside the city boundary (approximate match).')
  }

  const fields = LOCALITY_FIELDS.map((f) => norm(addr[f])).filter(Boolean)
  const tokens = placeTokens(place?.label)
  const matches = (f) => tokens.some((t) => f.includes(t) || (f.length >= 4 && t.includes(f)))
  if (fields.length === 0) {
    notes.push('The address has no town or locality.')
  } else if (tokens.length) {
    // The town itself is the strongest signal: a town in the same DISTRICT is still a different town.
    // If the town does not match, a matching sub-area (e.g. searching "Indiranagar") still counts.
    const town = norm(addr.municipality)
    const subAreas = ['localName', 'municipalitySubdivision', 'municipalitySecondarySubdivision', 'neighbourhood'].map((f) => norm(addr[f])).filter(Boolean)
    const hit = town ? (matches(town) || subAreas.some(matches)) : fields.some(matches)
    if (!hit) {
      const listed = addr.municipality || addr.localName || addr.municipalitySubdivision
      reasons.push(`The address names "${listed}", which does not match the searched place.`)
    }
  }

  if (addr.freeformAddress && !addr.streetName) notes.push('Address is area-level only (no street).')

  return { level: reasons.length ? 'check' : 'ok', reasons, notes }
}