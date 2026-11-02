// Frontend API helpers. All Google Maps access happens on the local server (server/index.js),
// so no API key ever reaches the browser. Vite proxies /api to that server in development.

export function computeLeadFactors(business) {
  const factors = []
  let score = 0

  if (business.websiteStatus === 'no_website') {
    score += 50
    factors.push({ label: 'No Website (Prime Target)', points: 50, type: 'high' })
  } else if (business.websiteStatus === 'inactive') {
    score += 30
    factors.push({ label: 'Broken / Inactive Website', points: 30, type: 'medium' })
  }

  if (business.phone) {
    score += 15
    factors.push({ label: 'Direct Phone Available', points: 15, type: 'positive' })
  }

  if (business.locality || business.address) {
    score += 10
    factors.push({ label: 'Physical Storefront Found', points: 10, type: 'positive' })
  }

  if (business.subcategories && business.subcategories.length > 0) {
    score += 10
    factors.push({ label: 'Verified Commercial Taxonomy', points: 10, type: 'positive' })
  }

  if (business.rating) {
    if (business.rating >= 4.5) { score += 15; factors.push({ label: 'High Rating (4.5+)', points: 15, type: 'positive' }) }
    else if (business.rating >= 4.0) { score += 10; factors.push({ label: 'Good Rating (4.0+)', points: 10, type: 'positive' }) }
    else { score += 5; factors.push({ label: 'Existing Reviews', points: 5, type: 'neutral' }) }
  }

  if (business.reviewCount > 50) {
    score += 10
    factors.push({ label: 'High Review Volume', points: 10, type: 'positive' })
  }

  const finalScore = Math.min(score, 100)
  return { score: finalScore, factors }
}

export function computeLeadScore(business) {
  return computeLeadFactors(business).score
}

export function getLeadLabel(score) {
  if (score >= 70) return 'high'
  if (score >= 40) return 'medium'
  return 'low'
}

// ─── Server calls ────────────────────────────────────────────────────────────
async function api(path, { signal, method = 'GET', body } = {}) {
  let res
  try {
    res = await fetch(path, {
      method,
      signal,
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    })
  } catch (err) {
    if (err.name === 'AbortError') throw err
    throw new Error('Could not reach the local API server. Start the app with "npm run dev" so the server is running.')
  }
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    const e = new Error(data?.error?.message || `The server returned an error (HTTP ${res.status}).`)
    e.code = data?.error?.code
    throw e
  }
  return data
}

/** Resolve a typed city into candidate places (Google Places, cities and districts only). */
export async function resolveCity(city, signal) {
  const data = await api(`/api/places/resolve?q=${encodeURIComponent(city.trim())}`, { signal })
  return data.places
}

/** Search one category inside a confirmed place. Returns { businesses, meta }. */
export async function fetchCategoryBusinesses(place, categoryId, signal, { force } = {}) {
  const p = new URLSearchParams({
    category: categoryId, lat: place.lat, lon: place.lon, label: place.label || '',
  })
  if (force) p.set('force', '1')
  if (place.viewport) {
    p.set('north', place.viewport.north); p.set('south', place.viewport.south)
    p.set('east', place.viewport.east);   p.set('west', place.viewport.west)
  }
  return api(`/api/places/search?${p}`, { signal })
}

/** Check up to 25 websites at once on the server. Returns { [url]: { status, note } }. */
export async function checkWebsites(urls, signal) {
  const data = await api('/api/websites/check', { method: 'POST', body: { urls }, signal })
  return data.results
}

/** Instant free-text POI search near a lat/lon – for hybrid search. */
export async function instantSearch(query, lat, lon, signal) {
  if (!query?.trim() || lat == null || lon == null) return []
  try {
    const p = new URLSearchParams({ q: query.trim(), lat, lon })
    const data = await api(`/api/places/instant?${p}`, { signal })
    return data.results || []
  } catch (err) {
    if (err.name === 'AbortError') throw err
    return []   // silently fail — instant search is best-effort
  }
}

export async function getServerHealth() {
  return api('/api/health')
}

/** Get a valid, guaranteed Google Maps place search URL for a business. */
export function getValidMapUrl(biz) {
  if (!biz) return '#'
  if (biz.mapUrl && biz.mapUrl.startsWith('http') && !biz.mapUrl.includes('null,null')) {
    return biz.mapUrl
  }
  const name = biz.name || biz.businessName || ''
  const loc = biz.address || [biz.locality, biz.city, biz.state].filter(Boolean).join(', ')
  if (name && loc) {
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${name}, ${loc}`)}`
  }
  if (name) {
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(name)}`
  }
  if (biz.lat != null && biz.lon != null) {
    return `https://www.google.com/maps/search/?api=1&query=${biz.lat},${biz.lon}`
  }
  if (loc) {
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(loc)}`
  }
  return '#'
}

// ─── Export to Excel ─────────────────────────────────────────────────────────
const STATUS_LABEL = { active: 'Active', inactive: 'Inactive', no_website: 'No website', checking: 'Checking' }
const NA = 'Not available'
const orNA = (v) => (v === null || v === undefined || v === '' ? NA : v)

export function businessesToRows(data) {
  return data.map((b) => ({
    Name: orNA(b.name),
    Category: orNA(b.category),
    'Category Match (Inferred)': orNA(b.categoryValidation?.status),
    'Validation Confidence (Inferred)': orNA(b.categoryValidation?.confidence),
    'Validation Reason (Inferred)': orNA(b.categoryValidation?.reason),
    'Google Primary Type (API)': orNA(b.primaryType),
    'Google Place Types (API)': orNA((b.types || []).join(', ')),
    Subcategories: orNA((b.subcategories || []).join(', ')),
    Address: orNA(b.address),
    Locality: orNA(b.locality),
    Street: orNA(b.street),
    City: orNA(b.city),
    State: orNA(b.state),
    'Postal Code': orNA(b.postalCode),
    Country: orNA(b.country),
    Phone: orNA(b.phone),
    'All Phones': orNA((b.phones || []).join(', ') || b.phone),
    Email: orNA(b.email),
    Website: orNA(b.website),
    'Website Status': STATUS_LABEL[b.websiteStatus] || orNA(b.websiteStatus),
    'Website Note': orNA(b.websiteNote),
    Rating: orNA(b.rating),
    Reviews: orNA(b.reviewCount),
    'Lead Score': orNA(b.leadScore),
    'Opening Hours': orNA(b.openingHours),
    'Distance (meters)': b.distanceMeters != null ? b.distanceMeters : NA,
    Latitude: orNA(b.lat),
    Longitude: orNA(b.lon),
    'Map Link': orNA(b.mapUrl || (b.lat != null && b.lon != null ? `https://www.google.com/maps/search/?api=1&query=${b.lat},${b.lon}` : null)),
    'Location Check': b.locationCheck ? (b.locationCheck.level === 'check' ? 'Verify before contacting' : 'No issues detected') : NA,
    'Location Notes': orNA([...(b.locationCheck?.reasons || []), ...(b.locationCheck?.notes || [])].join(' | ')),
    'Map Pin Link': orNA(b.pinUrl),
    'Geographic Match': b.geoMatch === 'inside_viewport' ? 'Inside city map area' : b.geoMatch === 'approximate' ? 'Approximate' : NA,
    Source: orNA(b.source),
  }))
}

export async function exportToExcel(data, filename = 'businesses.xlsx') {
  const XLSX = await import('xlsx')
  const ws = XLSX.utils.json_to_sheet(businessesToRows(data))
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Businesses')
  XLSX.writeFile(wb, filename)
}

export async function exportLeadsToExcel(leads, filename = 'leads.xlsx') {
  const XLSX = await import('xlsx')
  const rows = leads.map((l) => ({
    Name: l.name,
    Category: l.category,
    Subcategories: (l.subcategories || []).join(', '),
    City: l.city || '',
    Locality: l.locality || '',
    Address: l.address || '',
    'Postal Code': l.postalCode || '',
    Phone: l.phone || '',
    'All Phones': (l.phones || []).join(', ') || l.phone || '',
    Website: l.website || '',
    'Website Status': STATUS_LABEL[l.websiteStatus] || l.websiteStatus,
    'Lead Score': l.leadScore,
    'Contact Status': l.contactStatus,
    Notes: l.notes || '',
    'Preview Link': l.previewLink || '',
    'Added At': l.addedAt,
  }))
  const ws = XLSX.utils.json_to_sheet(rows)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Leads')
  XLSX.writeFile(wb, filename)
}