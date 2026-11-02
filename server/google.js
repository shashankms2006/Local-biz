import { ApiError } from './errors.js'
import { CATEGORY_DEFS } from './categories.js'
import { assessLocation } from './locationCheck.js'
import { validateBusinessCategory } from './categoryValidation.js'

const PLACES_URL = 'https://places.googleapis.com/v1/places:searchText'
const FIELD_MASK = [
  'places.id', 'places.displayName', 'places.formattedAddress', 'places.addressComponents',
  'places.location', 'places.nationalPhoneNumber', 'places.websiteUri', 'places.rating',
  'places.userRatingCount', 'places.regularOpeningHours', 'places.googleMapsUri',
  'places.businessStatus', 'places.types', 'places.primaryType', 'nextPageToken',
].join(',')

const CITY_TYPES = new Set(['locality', 'administrative_area_level_1', 'administrative_area_level_2',
  'administrative_area_level_3', 'sublocality', 'political', 'colloquial_area', 'neighborhood'])

const SOCIAL_HOSTS = /^(www\.)?(facebook|instagram|twitter|x\.com|linkedin|youtube|yelp|justdial|sulekha|indiamart|tradeindia|zomato|swiggy|tripadvisor|google)\./i

// Map Google addressComponents to a flat address object
function parseAddress(components = [], formattedAddress = '') {
  const get = (type) => (components.find((c) => c.types?.includes(type)) || {}).longText || null
  return {
    freeformAddress: formattedAddress || null,
    streetName: get('route'),
    municipality: get('locality') || get('administrative_area_level_3'),
    localName: get('sublocality') || get('sublocality_level_1'),
    municipalitySubdivision: get('sublocality_level_2'),
    municipalitySecondarySubdivision: get('sublocality_level_3'),
    neighbourhood: get('neighborhood'),
    countrySecondarySubdivision: get('administrative_area_level_2'),
    countryTertiarySubdivision: get('administrative_area_level_3'),
    postalCode: get('postal_code'),
    countrySubdivision: get('administrative_area_level_1'),
    country: get('country'),
  }
}

// Subcategory labels from Google types
const TYPE_LABELS = {
  hair_salon: 'Hair Salon', beauty_salon: 'Beauty Salon', barber_shop: 'Barber Shop',
  spa: 'Spa', massage: 'Massage', fitness_center: 'Fitness Center', gym: 'Gym',
  yoga_studio: 'Yoga Studio', sports_complex: 'Sports Complex', athletic_field: 'Athletic Field',
  stadium: 'Stadium', travel_agency: 'Travel Agency', tour_operator: 'Tour Operator',
  tourist_attraction: 'Tourist Attraction',
}
const CATEGORY_TYPE_SETS = {
  salon: ['hair_salon', 'beauty_salon', 'barber_shop'],
  spa: ['spa', 'massage'],
  gym: ['fitness_center', 'gym', 'yoga_studio', 'sports_complex', 'athletic_field'],
  turf: ['athletic_field', 'sports_complex', 'stadium'],
  travel: ['travel_agency', 'tour_operator', 'tourist_attraction'],
}

export function normaliseGoogleResult(place, categoryId) {
  const addr = parseAddress(place.addressComponents, place.formattedAddress)
  const types = place.types || []
  const relevant = (CATEGORY_TYPE_SETS[categoryId] || []).filter((t) => types.includes(t))
  const subcategories = relevant.map((t) => TYPE_LABELS[t] || t)

  const website = place.websiteUri && !SOCIAL_HOSTS.test(new URL(place.websiteUri).hostname)
    ? place.websiteUri : null

  return {
    id: place.id,
    name: place.displayName?.text || null,
    category: categoryId,
    primaryType: place.primaryType || null,
    types,
    subcategories,
    address: addr.freeformAddress,
    street: addr.streetName,
    locality: addr.localName || addr.municipalitySubdivision || null,
    city: addr.municipality,
    state: addr.countrySubdivision,
    postalCode: addr.postalCode,
    country: addr.country,
    lat: place.location?.latitude ?? null,
    lon: place.location?.longitude ?? null,
    phone: place.nationalPhoneNumber || null,
    phones: place.nationalPhoneNumber ? [place.nationalPhoneNumber] : [],
    email: null,
    website,
    websiteStatus: website ? 'checking' : 'no_website',
    websiteNote: null,
    rating: place.rating ?? null,
    reviewCount: place.userRatingCount ?? null,
    openingHours: place.regularOpeningHours?.weekdayDescriptions?.join(' | ') || null,
    mapUrl: place.googleMapsUri || null,
    pinUrl: place.location ? `https://www.google.com/maps/search/?api=1&query=${place.location.latitude},${place.location.longitude}` : null,
    source: 'google',
    geoMatch: 'inside_viewport',
    locationCheck: null,
    categoryValidation: null,
  }
}

async function postPlaces(url, body, apiKey, fetchImpl) {
  const res = await fetchImpl(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Goog-Api-Key': apiKey, 'X-Goog-FieldMask': FIELD_MASK },
    body: JSON.stringify(body),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    const st = data?.error?.status || ''
    const msg = (data?.error?.message || '').replace(apiKey, '<key>')
    if (res.status === 403 || st === 'PERMISSION_DENIED') throw new ApiError('AUTH_OR_QUOTA', 'Google Places API (New) key is invalid or the API is not enabled. Check your Google Cloud Console.', 403)
    if (res.status === 429 || st === 'RESOURCE_EXHAUSTED') throw new ApiError('RATE_LIMIT', 'Google Places quota exhausted. Wait or increase your quota.', 429)
    if (res.status === 400) throw new ApiError('BAD_REQUEST', `Google rejected the request: ${msg}`, 400)
    throw new ApiError('UPSTREAM', `Google Places returned an error (${res.status}).`, 502)
  }
  return data
}

export function createGoogleClient({ apiKey, fetchImpl = fetch, retryDelayMs = 1000 } = {}) {
  const call = async (body) => {
    if (!apiKey) throw new ApiError('NO_KEY', 'Google Maps API key is not configured. Add GOOGLE_MAPS_API_KEY to your .env file.', 503)
    try {
      return await postPlaces(PLACES_URL, body, apiKey, fetchImpl)
    } catch (err) {
      if (err instanceof ApiError && err.status === 429) {
        await new Promise((r) => setTimeout(r, retryDelayMs))
        return postPlaces(PLACES_URL, body, apiKey, fetchImpl)
      }
      throw err
    }
  }

  return {
    hasKey: Boolean(apiKey),

    async resolvePlaces(query) {
      if (!apiKey) throw new ApiError('NO_KEY', 'Google Maps API key is not configured.', 503)
      let data
      try {
        data = await postPlaces(PLACES_URL,
          { textQuery: query, pageSize: 5 },
          apiKey, fetchImpl)
      } catch (err) {
        if (err instanceof ApiError && err.status === 429) {
          await new Promise((r) => setTimeout(r, retryDelayMs))
          try {
            data = await postPlaces(PLACES_URL, { textQuery: query, pageSize: 5 }, apiKey, fetchImpl)
          } catch (e2) {
            throw e2 instanceof ApiError ? e2 : new ApiError('NETWORK', 'Could not reach Google Places.', 502)
          }
        } else if (err instanceof ApiError) {
          throw err
        } else {
          throw new ApiError('NETWORK', 'Could not reach Google Places. Check your internet connection.', 502)
        }
      }
      return (data.places || [])
        .filter((p) => (p.types || []).some((t) => CITY_TYPES.has(t)))
        .map((p) => ({
          id: p.id,
          label: p.formattedAddress || p.displayName?.text || '',
          lat: p.location?.latitude ?? 0,
          lon: p.location?.longitude ?? 0,
          entityType: (p.types || []).find((t) => CITY_TYPES.has(t)) || 'locality',
          viewport: p.viewport ? {
            north: p.viewport.high.latitude, south: p.viewport.low.latitude,
            east: p.viewport.high.longitude, west: p.viewport.low.longitude,
          } : null,
        }))
    },

    async getPlaceDetails(placeId) {
      if (!apiKey) throw new ApiError('NO_KEY', 'Google Maps API key is not configured.', 503)
      const res = await fetchImpl(
        `https://places.googleapis.com/v1/places/${encodeURIComponent(placeId)}?fields=${FIELD_MASK.replace(/places\./g, '').replace(',nextPageToken', '')}&key=${encodeURIComponent(apiKey)}`)
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new ApiError('UPSTREAM', 'Could not fetch place details.', 502)
      return data
    },

    _call: call,
  }
}

export async function searchCategoryGoogle({ client, place, categoryId }) {
  const def = CATEGORY_DEFS[categoryId]
  const cityName = place.label.split(',')[0].trim()
  const hasViewport = Boolean(place.viewport)
  const locationRestriction = hasViewport
    ? { rectangle: { low: { latitude: place.viewport.south, longitude: place.viewport.west }, high: { latitude: place.viewport.north, longitude: place.viewport.east } } }
    : null
  const locationBias = !hasViewport
    ? { circle: { center: { latitude: place.lat, longitude: place.lon }, radius: 25000 } }
    : null

  const seen = new Map()   // placeId -> business
  const seenNameAddr = new Set()
  const rejectedIds = new Set()
  let truncated = false
  const warnings = []
  let acceptedCount = 0, reviewCount = 0

  for (const term of def.terms) {
    let pageToken
    let page = 0
    do {
      const body = { textQuery: `${term} in ${cityName}`, pageSize: 20,
        ...(locationRestriction ? { locationRestriction } : { locationBias }) }
      if (pageToken) body.pageToken = pageToken
      const data = await client._call(body)
      pageToken = data.nextPageToken || null
      page++
      if (page >= 3 && pageToken) { truncated = true; pageToken = null }

      for (const p of data.places || []) {
        if (p.businessStatus === 'CLOSED_PERMANENTLY') continue
        if (seen.has(p.id)) continue
        const nameAddr = `${p.displayName?.text}|${p.formattedAddress}`
        if (seenNameAddr.has(nameAddr)) continue

        const biz = normaliseGoogleResult(p, categoryId)

        // Category validation
        const validation = validateBusinessCategory({ name: biz.name, primaryType: biz.primaryType, types: biz.types }, categoryId)
        biz.categoryValidation = validation
        if (validation.status === 'REJECT') { rejectedIds.add(p.id); continue }
        if (validation.status === 'ACCEPT') acceptedCount++
        else reviewCount++

        // Location check
        const addrObj = parseAddress(p.addressComponents, p.formattedAddress)
        biz.locationCheck = assessLocation(
          { address: addrObj },
          { place, geoMatch: biz.geoMatch }
        )

        if (p.businessStatus === 'CLOSED_TEMPORARILY') {
          biz.locationCheck = { ...biz.locationCheck, notes: [...(biz.locationCheck.notes || []), 'This business is temporarily closed.'] }
        }

        seen.set(p.id, biz)
        seenNameAddr.add(nameAddr)
      }
    } while (pageToken)

    if (truncated) warnings.push(`Google returns at most 60 results per query. Some businesses in ${cityName} may not appear. Try district-level searches for better coverage.`)
  }

  if (seen.size === 0 && rejectedIds.size === 0) {
    warnings.push(`No ${def.label.toLowerCase()} found in ${cityName}. Try a different spelling or a district name.`)
  }

  const hasClosed = [...seen.values()].some((b) => b.locationCheck?.notes?.some((n) => /temporarily closed/.test(n)))
  if (hasClosed) warnings.push(`Some results are temporarily closed.`)

  return {
    businesses: [...seen.values()],
    meta: { truncated, warnings, rejectedCount: rejectedIds.size, acceptedCount, reviewCount, provider: 'google' },
  }
}

export async function instantSearchGoogle({ client, q, lat, lon }) {
  if (!client.hasKey) return []
  const body = {
    textQuery: q,
    pageSize: 5,
    locationBias: { circle: { center: { latitude: lat, longitude: lon }, radius: 25000 } },
  }
  const data = await client._call(body)
  return (data.places || []).map((p) => ({
    id: p.id,
    name: p.displayName?.text || '',
    address: p.formattedAddress || '',
    lat: p.location?.latitude ?? null,
    lon: p.location?.longitude ?? null,
    source: 'google',
  }))
}
