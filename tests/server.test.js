// Run with: npm test
// Google is mocked, so these tests need no API key and make no network calls.
import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { createApp } from '../server/index.js'
import { createGoogleClient, searchCategoryGoogle, normaliseGoogleResult } from '../server/google.js'
import { ApiError } from '../server/errors.js'
import { assessLocation, placeTokens } from '../server/locationCheck.js'
import { checkWebsite, isPrivateIp } from '../server/websiteCheck.js'
import { businessesToRows } from '../src/utils/api.js'
import { validateBusinessCategory, VALIDATION_STATUS, VALIDATION_CONFIDENCE } from '../src/utils/categoryValidation.js'

async function withServer(google, fn, checker) {
  const app = createApp({ google, checker })
  const srv = app.listen(0, '127.0.0.1')
  await new Promise((r) => srv.once('listening', r))
  const base = `http://127.0.0.1:${srv.address().port}`
  try { await fn(base) } finally { srv.close() }
}

// ── Website status (independent of the places search) ───────────────────────────────────
const PUB = 'http://93.184.216.34'   // public IP literal -> no DNS needed in tests
const resp = (status, headers = {}) => async () => new Response('', { status, headers })

test('#12 website statuses: active / inactive / blocking / social / none', async () => {
  assert.deepEqual(await checkWebsite(null), { status: 'no_website', note: '' })
  assert.equal((await checkWebsite('instagram.com/foo')).status, 'no_website')
  assert.equal((await checkWebsite(PUB, { fetchImpl: resp(200) })).status, 'active')
  assert.equal((await checkWebsite(PUB, { fetchImpl: resp(404) })).status, 'inactive')
  const blocked = await checkWebsite(PUB, { fetchImpl: resp(403) })
  assert.equal(blocked.status, 'active'); assert.match(blocked.note, /blocks/)
})

test('redirects are followed; redirect loops end as inactive', async () => {
  let n = 0
  const redirectThenOk = async () => (++n === 1 ? new Response('', { status: 301, headers: { location: 'https://93.184.216.35/home' } }) : new Response('', { status: 200 }))
  assert.equal((await checkWebsite(PUB, { fetchImpl: redirectThenOk })).status, 'active')
  const loop = async () => new Response('', { status: 302, headers: { location: PUB + '/x' } })
  const looped = await checkWebsite(PUB, { fetchImpl: loop })
  assert.equal(looped.status, 'inactive'); assert.match(looped.note, /redirects/)
})

test('timeouts, DNS and TLS errors are inactive with a reason, and never throw', async () => {
  const abort = async () => { throw Object.assign(new Error('aborted'), { name: 'AbortError' }) }
  assert.match((await checkWebsite(PUB, { fetchImpl: abort })).note, /Timed out/)
  const tls = async () => { throw Object.assign(new TypeError('fetch failed'), { cause: { code: 'CERT_HAS_EXPIRED' } }) }
  assert.match((await checkWebsite(PUB, { fetchImpl: tls })).note, /SSL/)
  const dnsErr = async () => { throw Object.assign(new TypeError('fetch failed'), { cause: { code: 'ENOTFOUND' } }) }
  assert.match((await checkWebsite(PUB, { fetchImpl: dnsErr })).note, /Domain not found/)
  assert.equal((await checkWebsite('http://[::1', { fetchImpl: resp(200) })).status, 'inactive')   // malformed URL
})

test('server-side request forgery guard blocks private addresses', async () => {
  for (const ip of ['127.0.0.1', '10.0.0.5', '192.168.1.1', '169.254.169.254', '172.16.0.1', '::1', 'fd00::1']) assert.equal(isPrivateIp(ip), true, ip)
  assert.equal(isPrivateIp('93.184.216.34'), false)
  let called = false
  const r = await checkWebsite('http://127.0.0.1:80/admin', { fetchImpl: async () => { called = true; return new Response('', { status: 200 }) } })
  assert.equal(r.status, 'inactive'); assert.equal(called, false)
})

test('website-check endpoint validates input and uses the checker', async () => {
  await withServer(createGoogleClient({ apiKey: 'k' }), async (base) => {
    const post = (body) => fetch(`${base}/api/websites/check`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })
    assert.equal((await post({ urls: [] })).status, 400)
    assert.equal((await post({ urls: Array(26).fill('a.com') })).status, 400)
    assert.equal((await post({ urls: [5] })).status, 400)
    const ok = await (await post({ urls: ['a.com'] })).json()
    assert.deepEqual(ok.results['a.com'], { status: 'active', note: '' })
  }, async (urls) => Object.fromEntries(urls.map((u) => [u, { status: 'active', note: '' }])))
})

// ── Excel export ──────────────────────────────────────────────────────────────
test('#12 Excel rows: "Not available" for blanks, readable status labels, filtered subset only', async () => {
  const data = [
    { name: 'A', category: 'gym', address: 'X', phone: null, website: null, websiteStatus: 'no_website', lat: 1, lon: 2, leadScore: 65, source: 'google', geoMatch: 'inside_viewport' },
    { name: 'B', category: 'gym', website: 'b.com', websiteStatus: 'active', leadScore: 0, source: 'google', geoMatch: 'approximate' },
  ]
  const rows = businessesToRows(data.filter((d) => d.websiteStatus !== 'active'))   // what the table shows after filtering
  assert.equal(rows.length, 1)
  assert.equal(rows[0]['Website Status'], 'No website')
  assert.equal(rows[0].Phone, 'Not available')
  assert.equal(rows[0]['Map Link'], 'https://www.google.com/maps/search/?api=1&query=1,2')
  assert.equal(rows[0]['Geographic Match'], 'Inside city map area')
  assert.equal(businessesToRows(data)[1].Rating, 'Not available')

  // and a real .xlsx file round-trips
  const XLSX = await import('xlsx')
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'xl-'))
  const file = path.join(dir, 'out.xlsx')
  const ws = XLSX.utils.json_to_sheet(businessesToRows(data))
  const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, 'Businesses')
  fs.writeFileSync(file, XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }))
  const back = XLSX.utils.sheet_to_json(XLSX.read(fs.readFileSync(file)).Sheets.Businesses)
  assert.equal(back.length, 2); assert.equal(back[0].Name, 'A')
})

// ── Location doubt flags ──────────────────────────────────────────────────────
const addrResult = (address, extra = {}) => ({ id: 'z', poi: { name: 'Fit Zone', ...extra }, address, position: { lat: 12.97, lon: 77.59 } })
const BLR = { label: 'Bengaluru, Karnataka, India', lat: 12.97, lon: 77.59 }

test('alias spellings: "Bangalore" in an address matches a search for "Bengaluru"', () => {
  assert.ok(placeTokens('Mysuru, Karnataka').includes('mysore'))
  const r = addrResult({ freeformAddress: '5 MG Road, Bangalore', municipality: 'Bangalore', streetName: 'MG Road' })
  assert.equal(assessLocation(r, { place: BLR, geoMatch: 'inside_viewport' }).level, 'ok')
})

test('address in a different town is flagged "verify" with a reason', () => {
  const r = addrResult({ freeformAddress: '12 Main St, Mysore', municipality: 'Mysore', streetName: 'Main St' })
  const out = assessLocation(r, { place: BLR, geoMatch: 'inside_viewport' })
  assert.equal(out.level, 'check')
  assert.match(out.reasons[0], /Mysore/)
})

test('approximate match and missing address are flagged; area-level address is only a note', () => {
  const r = addrResult({ freeformAddress: 'X, Bengaluru', municipality: 'Bengaluru', streetName: 'X' })
  assert.equal(assessLocation(r, { place: BLR, geoMatch: 'approximate' }).level, 'check')
  assert.equal(assessLocation(addrResult({}), { place: BLR, geoMatch: 'inside_viewport' }).level, 'check')
  const area = assessLocation(addrResult({ freeformAddress: 'Indiranagar, Bengaluru', municipality: 'Bengaluru' }), { place: BLR, geoMatch: 'inside_viewport' })
  assert.equal(area.level, 'ok'); assert.equal(area.notes.length, 1)
})

test('export includes location check columns', () => {
  const rows = businessesToRows([{ name: 'A', websiteStatus: 'no_website', locationCheck: { level: 'check', reasons: ['r1'], notes: ['n1'] }, pinUrl: 'u' }])
  assert.equal(rows[0]['Location Check'], 'Verify before contacting')
  assert.equal(rows[0]['Location Notes'], 'r1 | n1')
  assert.equal(rows[0]['Map Pin Link'], 'u')
})

// ── Google Places provider ────────────────────────────────────────────────────

const GKEY = 'GOOGLE_SECRET_987'
/** Mock Google: handler(body, headers) -> object | Response. Records every call. */
function gMock(handler) {
  const calls = []
  const fn = async (url, init) => {
    const body = JSON.parse(init.body)
    calls.push({ url: String(url), body, headers: init.headers })
    const r = await handler(body, init.headers, calls.length)
    return r instanceof Response ? r : new Response(JSON.stringify(r), { status: 200, headers: { 'content-type': 'application/json' } })
  }
  fn.calls = calls
  return fn
}
const gClient = (f) => createGoogleClient({ apiKey: GKEY, fetchImpl: f, retryDelayMs: 1 })
const gPlace = (id, name, extra = {}) => ({
  id, displayName: { text: name }, formattedAddress: `${name} Rd, Mysuru, Karnataka 570001, India`,
  location: { latitude: 12.3, longitude: 76.65 },
  addressComponents: [
    { longText: 'Mysuru', types: ['locality'] }, { longText: 'Mysuru', types: ['administrative_area_level_2'] },
    { longText: 'Karnataka', types: ['administrative_area_level_1'] }, { longText: 'Main Rd', types: ['route'] },
    { longText: '570001', types: ['postal_code'] }, { longText: 'India', types: ['country'] },
  ],
  ...extra,
})
const MYS = { label: 'Mysuru, Karnataka, India', lat: 12.3, lon: 76.65, viewport: { north: 12.4, south: 12.2, east: 76.75, west: 76.55 } }

test('google: key is sent in a header (never the URL); field mask and rectangle restriction are set', async () => {
  const f = gMock(() => ({ places: [] }))
  await searchCategoryGoogle({ client: gClient(f), place: MYS, categoryId: 'gym' })
  const c = f.calls[0]
  assert.ok(!c.url.includes(GKEY))
  assert.equal(c.headers['X-Goog-Api-Key'], GKEY)
  assert.match(c.headers['X-Goog-FieldMask'], /places\.websiteUri/)
  assert.equal(c.body.textQuery, 'gym in Mysuru')
  assert.equal(c.body.pageSize, 20)
  assert.deepEqual(c.body.locationRestriction.rectangle, { low: { latitude: 12.2, longitude: 76.55 }, high: { latitude: 12.4, longitude: 76.75 } })
})

test('google: real rating, phone, website, hours and Maps link are mapped; nothing is invented', async () => {
  const f = gMock(() => ({ places: [
    gPlace('p1', 'Iron Gym', { nationalPhoneNumber: '0821 242 5000', websiteUri: 'https://irongym.in', rating: 4.6, userRatingCount: 212,
      regularOpeningHours: { weekdayDescriptions: ['Monday: 6:00 AM – 9:00 PM'] }, googleMapsUri: 'https://maps.google.com/?cid=1', types: ['gym', 'point_of_interest', 'establishment'] }),
    gPlace('p2', 'Bare Gym'),
  ] }))
  const { businesses } = await searchCategoryGoogle({ client: gClient(f), place: MYS, categoryId: 'gym' })
  const a = businesses.find((b) => b.name === 'Iron Gym'), b = businesses.find((x) => x.name === 'Bare Gym')
  assert.equal(a.rating, 4.6); assert.equal(a.reviewCount, 212); assert.equal(a.phone, '0821 242 5000')
  assert.equal(a.website, 'https://irongym.in'); assert.equal(a.websiteStatus, 'checking')
  assert.equal(a.mapUrl, 'https://maps.google.com/?cid=1'); assert.deepEqual(a.subcategories, ['Gym'])
  assert.equal(a.city, 'Mysuru'); assert.equal(a.postalCode, '570001'); assert.equal(a.source, 'google')
  assert.equal(b.rating, null); assert.equal(b.phone, null); assert.equal(b.website, null)
  assert.equal(b.websiteStatus, 'no_website'); assert.equal(b.openingHours, null)
})

test('google: duplicates across terms merged; permanently closed excluded; temporarily closed noted', async () => {
  const f = gMock(() => ({ places: [gPlace('d1', 'Dup Gym'), gPlace('d2', 'Dup Gym'), gPlace('c1', 'Gone Gym', { businessStatus: 'CLOSED_PERMANENTLY' }),
    gPlace('t1', 'Paused Gym', { businessStatus: 'CLOSED_TEMPORARILY' })] }))
  const { businesses, meta } = await searchCategoryGoogle({ client: gClient(f), place: MYS, categoryId: 'gym' })
  assert.deepEqual(businesses.map((b) => b.name).sort(), ['Dup Gym', 'Paused Gym'])
  assert.ok(meta.warnings.some((w) => /closed/.test(w)))
  assert.ok(businesses.find((b) => b.name === 'Paused Gym').locationCheck.notes.some((n) => /temporarily closed/.test(n)))
})

test('google: pagination follows nextPageToken up to 3 pages and warns about the 60-result cap', async () => {
  const pagesByQuery = new Map()
  const f = gMock((body) => {
    const page = pagesByQuery.get(body.textQuery) || 0
    pagesByQuery.set(body.textQuery, page + 1)
    return {
      places: [gPlace(`id-${body.pageToken || 0}-${body.textQuery}`, `G ${body.pageToken || 0} ${body.textQuery}`)],
      ...(page < 3 ? { nextPageToken: page === 0 ? 'tok' : `tok-${page + 1}` } : {}),
    }
  })
  const { meta } = await searchCategoryGoogle({ client: gClient(f), place: MYS, categoryId: 'salon' })
  assert.equal(f.calls.length, 6)                       // 2 terms x 3 pages
  assert.ok(f.calls.some((c) => c.body.pageToken === 'tok'))
  assert.equal(meta.truncated, true)
  assert.ok(meta.warnings.some((w) => /60 results/.test(w)))
})

test('google: address in another town is flagged "verify"; matching town (incl. alias) is not', async () => {
  const other = gPlace('o1', 'Far Gym', { addressComponents: [{ longText: 'Hunsur', types: ['locality'] }, { longText: 'Mysuru', types: ['administrative_area_level_2'] }] })
  const f = gMock(() => ({ places: [other, gPlace('m1', 'Near Gym')] }))
  const { businesses } = await searchCategoryGoogle({ client: gClient(f), place: { ...MYS, label: 'Mysore, Karnataka' }, categoryId: 'gym' })
  const far = businesses.find((b) => b.name === 'Far Gym').locationCheck
  assert.equal(far.level, 'check')                       // Hunsur is in Mysuru DISTRICT but is a different town
  assert.match(far.reasons[0], /Hunsur/)
  assert.equal(businesses.find((b) => b.name === 'Near Gym').locationCheck.level, 'ok')
})

test('google: resolve keeps cities/districts, maps viewport, drops shops', async () => {
  const f = gMock(() => ({ places: [
    { id: 'c', displayName: { text: 'Mysuru' }, formattedAddress: 'Mysuru, Karnataka, India', location: { latitude: 12.29, longitude: 76.63 },
      viewport: { low: { latitude: 12.2, longitude: 76.5 }, high: { latitude: 12.4, longitude: 76.8 } }, types: ['locality', 'political'] },
    { id: 's', displayName: { text: 'Mysore Shop' }, formattedAddress: 'Somewhere', location: { latitude: 1, longitude: 1 }, types: ['store', 'point_of_interest'] },
  ] }))
  const places = await gClient(f).resolvePlaces('Mysuru')
  assert.equal(places.length, 1)
  assert.deepEqual(places[0].viewport, { north: 12.4, south: 12.2, east: 76.8, west: 76.5 })
  assert.equal(places[0].entityType, 'locality')
})

test('google errors: 403 -> clear message, 429 quota -> RATE_LIMIT, 400, network, missing key; key never leaks', async () => {
  const status = (code, st) => gMock(() => new Response(JSON.stringify({ error: { status: st, message: `bad key ${GKEY}` } }), { status: code }))
  const run = (f) => gClient(f).resolvePlaces('x')
  await assert.rejects(() => run(status(403, 'PERMISSION_DENIED')), (e) => { assert.equal(e.code, 'AUTH_OR_QUOTA'); assert.match(e.message, /Places API \(New\)/); assert.ok(!e.message.includes(GKEY)); return true })
  await assert.rejects(() => run(status(429, 'RESOURCE_EXHAUSTED')), (e) => e.code === 'RATE_LIMIT' && !e.message.includes(GKEY))
  await assert.rejects(() => run(status(400, 'INVALID_ARGUMENT')), (e) => e.code === 'BAD_REQUEST')
  await assert.rejects(() => createGoogleClient({ apiKey: GKEY, fetchImpl: async () => { throw new TypeError('x') } }).resolvePlaces('x'), (e) => e.code === 'NETWORK')
  await assert.rejects(() => createGoogleClient({ apiKey: '' }).resolvePlaces('x'), (e) => e.code === 'NO_KEY')
  let n = 0
  const flaky = gMock(() => (++n === 1 ? new Response('{}', { status: 429 }) : { places: [] }))
  assert.deepEqual(await run(flaky), [])                // plain 429 retries once
})


test('google over HTTP: health, resolve, search and instant endpoints; no key in any response', async () => {
  const f = gMock((body) => body.locationBias
    ? { places: [gPlace('i1', 'Instant Spa')] }
    : body.locationRestriction ? { places: [gPlace('h1', 'HTTP Gym', { rating: 4.2, userRatingCount: 30 })] }
    : { places: [{ id: 'c', displayName: { text: 'Mysuru' }, formattedAddress: 'Mysuru, Karnataka, India', location: { latitude: 12.3, longitude: 76.6 }, types: ['locality'] }] })
  await withServer(gClient(f), async (base) => {
    const healthText = await (await fetch(`${base}/api/health`)).text()
    assert.ok(!healthText.includes(GKEY)); assert.match(healthText, /"configured":true/)
    const resolved = await (await fetch(`${base}/api/places/resolve?q=Mysuru`)).json()
    assert.equal(resolved.places[0].label, 'Mysuru, Karnataka, India')
    const res = await fetch(`${base}/api/places/search?category=gym&lat=12.3&lon=76.6&label=Mysuru&north=12.4&south=12.2&east=76.8&west=76.5`)
    const text = await res.text()
    assert.equal(res.status, 200); assert.ok(!text.includes(GKEY))
    assert.equal(JSON.parse(text).businesses[0].rating, 4.2)
    const inst = await (await fetch(`${base}/api/places/instant?q=spa&lat=12.3&lon=76.6`)).json()
    assert.equal(inst.results[0].name, 'Instant Spa'); assert.equal(inst.results[0].source, 'google')
  })
})

test('API validation: nonsense city -> 404, short query -> 400, unsupported category and bad coordinates -> 400', async () => {
  const f = gMock(() => ({ places: [] }))
  await withServer(gClient(f), async (base) => {
    assert.equal((await fetch(`${base}/api/places/resolve?q=zzzzqqqq`)).status, 404)
    assert.equal((await fetch(`${base}/api/places/resolve?q=a`)).status, 400)
    const r = await fetch(`${base}/api/places/search?category=bakery&lat=1&lon=1`)
    assert.equal(r.status, 400); assert.equal((await r.json()).error.code, 'UNSUPPORTED_CATEGORY')
    assert.equal((await fetch(`${base}/api/places/search?category=gym&lat=999&lon=1`)).status, 400)
    assert.equal((await fetch(`${base}/api/places/search?category=gym&lat=abc&lon=1`)).status, 400)
  })
})

test('API auth failure and quota exhaustion surface with clear codes and no key in the body', async () => {
  for (const [code, st, expectCode] of [[403, 'PERMISSION_DENIED', 'AUTH_OR_QUOTA'], [429, 'RESOURCE_EXHAUSTED', 'RATE_LIMIT']]) {
    const f = gMock(() => new Response(JSON.stringify({ error: { status: st, message: `leak ${GKEY}` } }), { status: code }))
    await withServer(gClient(f), async (base) => {
      const r = await fetch(`${base}/api/places/search?category=gym&lat=13&lon=76&label=X&north=14&south=12&east=77&west=75`)
      const text = await r.text()
      assert.equal(r.status, code); assert.ok(!text.includes(GKEY)); assert.match(text, new RegExp(expectCode))
    })
  }
})

test('parallel category searches for one city all succeed independently', async () => {
  const f = gMock((body) => ({ places: [gPlace(`id-${body.textQuery}`, `P ${body.textQuery}`)] }))
  await withServer(gClient(f), async (base) => {
    const out = await Promise.all(['gym', 'salon', 'spa', 'turf', 'travel'].map((c) =>
      fetch(`${base}/api/places/search?category=${c}&lat=12.3&lon=76.6&label=Mysuru&north=12.4&south=12.2&east=76.8&west=76.5`).then((r) => r.json())))
    assert.ok(out.every((o) => o.businesses.length >= 1))
  })
})

// ── Category Validation Layer Tests ──────────────────────────────────────────

test('category validation: a public park appearing in Turfs & Playgrounds is rejected', async () => {
  const parkPlace = gPlace('p_park', 'Kuvempu Municipal Public Park', {
    primaryType: 'park',
    types: ['park', 'point_of_interest', 'establishment'],
  })
  // 1. Direct validation check
  const val = validateBusinessCategory({ name: parkPlace.displayName.text, primaryType: parkPlace.primaryType, types: parkPlace.types }, 'turf')
  assert.equal(val.status, VALIDATION_STATUS.REJECT)
  assert.match(val.reason, /park/i)

  // 2. Search category integration check
  const f = gMock(() => ({ places: [parkPlace] }))
  const { businesses, meta } = await searchCategoryGoogle({ client: gClient(f), place: MYS, categoryId: 'turf' })
  assert.equal(businesses.length, 0)
  assert.equal(meta.rejectedCount, 1)
})

test('category validation: a school ground appearing in Turfs & Playgrounds is rejected', async () => {
  const schoolGround = gPlace('p_school', 'St. Joseph High School Ground', {
    primaryType: 'school',
    types: ['school', 'playground', 'establishment'],
  })
  const val = validateBusinessCategory({ name: schoolGround.displayName.text, primaryType: schoolGround.primaryType, types: schoolGround.types }, 'turf')
  assert.equal(val.status, VALIDATION_STATUS.REJECT)
  assert.match(val.reason, /educational institution|school/i)

  const f = gMock(() => ({ places: [schoolGround] }))
  const { businesses, meta } = await searchCategoryGoogle({ client: gClient(f), place: MYS, categoryId: 'turf' })
  assert.equal(businesses.length, 0)
  assert.equal(meta.rejectedCount, 1)
})

test('category validation: a commercial football turf appearing in Turfs & Playgrounds is accepted', async () => {
  const footballTurf = gPlace('p_turf', 'Kickoff Football Turf & Sports Arena', {
    primaryType: 'athletic_field',
    types: ['athletic_field', 'sports_complex', 'point_of_interest'],
  })
  const val = validateBusinessCategory({ name: footballTurf.displayName.text, primaryType: footballTurf.primaryType, types: footballTurf.types }, 'turf')
  assert.equal(val.status, VALIDATION_STATUS.ACCEPT)
  assert.equal(val.confidence, VALIDATION_CONFIDENCE.HIGH)

  const f = gMock(() => ({ places: [footballTurf] }))
  const { businesses, meta } = await searchCategoryGoogle({ client: gClient(f), place: MYS, categoryId: 'turf' })
  assert.equal(businesses.length, 1)
  assert.equal(businesses[0].name, 'Kickoff Football Turf & Sports Arena')
  assert.equal(businesses[0].categoryValidation.status, VALIDATION_STATUS.ACCEPT)
  assert.equal(meta.acceptedCount, 1)
  assert.equal(meta.rejectedCount, 0)
})

test('category validation: a photo studio appearing in Spas is rejected', async () => {
  const photoStudio = gPlace('p_photo', 'Shine Photography & Wedding Studio', {
    primaryType: 'photo_studio',
    types: ['photo_studio', 'point_of_interest', 'establishment'],
  })
  const val = validateBusinessCategory({ name: photoStudio.displayName.text, primaryType: photoStudio.primaryType, types: photoStudio.types }, 'spa')
  assert.equal(val.status, VALIDATION_STATUS.REJECT)
  assert.match(val.reason, /photography/i)

  const f = gMock(() => ({ places: [photoStudio] }))
  const { businesses, meta } = await searchCategoryGoogle({ client: gClient(f), place: MYS, categoryId: 'spa' })
  assert.equal(businesses.length, 0)
  assert.equal(meta.rejectedCount, 1)
})

test('category validation: a genuine spa appearing in Spas is accepted', async () => {
  const genuineSpa = gPlace('p_spa', 'Lotus Ayurvedic Day Spa & Massage Centre', {
    primaryType: 'spa',
    types: ['spa', 'massage', 'point_of_interest'],
  })
  const val = validateBusinessCategory({ name: genuineSpa.displayName.text, primaryType: genuineSpa.primaryType, types: genuineSpa.types }, 'spa')
  assert.equal(val.status, VALIDATION_STATUS.ACCEPT)
  assert.equal(val.confidence, VALIDATION_CONFIDENCE.HIGH)

  const f = gMock(() => ({ places: [genuineSpa] }))
  const { businesses, meta } = await searchCategoryGoogle({ client: gClient(f), place: MYS, categoryId: 'spa' })
  assert.equal(businesses.length, 1)
  assert.equal(businesses[0].name, 'Lotus Ayurvedic Day Spa & Massage Centre')
  assert.equal(businesses[0].categoryValidation.status, VALIDATION_STATUS.ACCEPT)
  assert.equal(meta.acceptedCount, 1)
})

test('category validation: an ashram appearing in Gyms is rejected', async () => {
  const ashram = gPlace('p_ashram', 'Sri Ramakrishna Ashram & Meditation Hall', {
    primaryType: 'hindu_temple',
    types: ['hindu_temple', 'place_of_worship', 'point_of_interest'],
  })
  const val = validateBusinessCategory({ name: ashram.displayName.text, primaryType: ashram.primaryType, types: ashram.types }, 'gym')
  assert.equal(val.status, VALIDATION_STATUS.REJECT)
  assert.match(val.reason, /religious institution|ashram/i)

  const f = gMock(() => ({ places: [ashram] }))
  const { businesses, meta } = await searchCategoryGoogle({ client: gClient(f), place: MYS, categoryId: 'gym' })
  assert.equal(businesses.length, 0)
  assert.equal(meta.rejectedCount, 1)
})

test('category validation: a commercial fitness centre appearing in Gyms is accepted', async () => {
  const fitnessCenter = gPlace('p_gym', 'Powerhouse Fitness Centre & Bodybuilding Gym', {
    primaryType: 'fitness_center',
    types: ['fitness_center', 'gym', 'point_of_interest'],
  })
  const val = validateBusinessCategory({ name: fitnessCenter.displayName.text, primaryType: fitnessCenter.primaryType, types: fitnessCenter.types }, 'gym')
  assert.equal(val.status, VALIDATION_STATUS.ACCEPT)
  assert.equal(val.confidence, VALIDATION_CONFIDENCE.HIGH)

  const f = gMock(() => ({ places: [fitnessCenter] }))
  const { businesses, meta } = await searchCategoryGoogle({ client: gClient(f), place: MYS, categoryId: 'gym' })
  assert.equal(businesses.length, 1)
  assert.equal(businesses[0].name, 'Powerhouse Fitness Centre & Bodybuilding Gym')
  assert.equal(businesses[0].categoryValidation.status, VALIDATION_STATUS.ACCEPT)
  assert.equal(meta.acceptedCount, 1)
})

test('category validation: a yoga-only centre appearing in Gyms is rejected', async () => {
  const yogaCentre = gPlace('p_yoga', 'Sivananda Yoga Vedanta Centre', {
    primaryType: 'yoga_studio',
    types: ['yoga_studio', 'point_of_interest'],
  })
  const val = validateBusinessCategory({ name: yogaCentre.displayName.text, primaryType: yogaCentre.primaryType, types: yogaCentre.types }, 'gym')
  assert.equal(val.status, VALIDATION_STATUS.REJECT)
  assert.match(val.reason, /yoga-only/i)

  const f = gMock(() => ({ places: [yogaCentre] }))
  const { businesses, meta } = await searchCategoryGoogle({ client: gClient(f), place: MYS, categoryId: 'gym' })
  assert.equal(businesses.length, 0)
  assert.equal(meta.rejectedCount, 1)
})

test('category validation: a business whose category cannot be determined confidently is REVIEW', async () => {
  const vaguePlace = gPlace('p_vague', 'Sunrise Community Centre', {
    primaryType: null,
    types: ['point_of_interest', 'establishment'],
  })
  const val = validateBusinessCategory({ name: vaguePlace.displayName.text, primaryType: null, types: vaguePlace.types }, 'gym')
  assert.equal(val.status, VALIDATION_STATUS.REVIEW)
  assert.equal(val.confidence, VALIDATION_CONFIDENCE.LOW)
  assert.match(val.reason, /insufficient evidence/i)

  const f = gMock(() => ({ places: [vaguePlace] }))
  const { businesses, meta } = await searchCategoryGoogle({ client: gClient(f), place: MYS, categoryId: 'gym' })
  // Retained so legitimate businesses are not silently lost
  assert.equal(businesses.length, 1)
  assert.equal(businesses[0].categoryValidation.status, VALIDATION_STATUS.REVIEW)
  assert.equal(meta.reviewCount, 1)
})

test('category validation: sports ground handling accepts commercial, reviews generic, rejects school', () => {
  // Commercial sports ground with athletic_field type
  const commGround = { name: 'City Sports Ground', primaryType: 'athletic_field', types: ['athletic_field', 'sports_complex'] }
  assert.equal(validateBusinessCategory(commGround, 'turf').status, VALIDATION_STATUS.ACCEPT)

  // School sports ground
  const schoolGround = { name: 'St. Mary Sports Ground', primaryType: 'school', types: ['school'] }
  assert.equal(validateBusinessCategory(schoolGround, 'turf').status, VALIDATION_STATUS.REJECT)

  // Generic sports ground with no types
  const genericGround = { name: 'East Sports Ground', primaryType: null, types: ['point_of_interest'] }
  assert.equal(validateBusinessCategory(genericGround, 'turf').status, VALIDATION_STATUS.REVIEW)
})

test('category validation: ordinary salons without spa evidence are rejected for Spas', () => {
  const salon = { name: 'Classic Men Hair Salon', primaryType: 'hair_salon', types: ['hair_salon', 'beauty_salon'] }
  assert.equal(validateBusinessCategory(salon, 'spa').status, VALIDATION_STATUS.REJECT)

  const salonWithSpa = { name: 'Aroma Beauty Parlour & Day Spa', primaryType: 'beauty_salon', types: ['beauty_salon', 'spa'] }
  assert.equal(validateBusinessCategory(salonWithSpa, 'spa').status, VALIDATION_STATUS.ACCEPT)
})

test('table and Excel export filtering: rejected places excluded, unverified places distinguished, validation columns included', async () => {
  const mixedData = [
    {
      id: 'g_1', name: 'Kickoff Football Turf', category: 'turf',
      primaryType: 'athletic_field', types: ['athletic_field'],
      categoryValidation: { status: 'ACCEPT', confidence: 'HIGH', reason: 'Commercial football turf.' },
      websiteStatus: 'active', lat: 12.3, lon: 76.6, leadScore: 80, source: 'google', geoMatch: 'inside_viewport',
    },
    {
      id: 'g_2', name: 'Town Municipal Park', category: 'turf',
      primaryType: 'park', types: ['park'],
      categoryValidation: { status: 'REJECT', confidence: 'HIGH', reason: 'Public park.' },
      websiteStatus: 'no_website', lat: 12.31, lon: 76.61, leadScore: 50, source: 'google', geoMatch: 'inside_viewport',
    },
    {
      id: 'g_3', name: 'Open Community Ground', category: 'turf',
      primaryType: null, types: ['point_of_interest'],
      categoryValidation: { status: 'REVIEW', confidence: 'LOW', reason: 'Unverified ground.' },
      websiteStatus: 'no_website', lat: 12.32, lon: 76.62, leadScore: 40, source: 'google', geoMatch: 'inside_viewport',
    },
  ]

  // Main table shows ACCEPT by default
  const tableData = mixedData.filter((b) => b.categoryValidation?.status === 'ACCEPT')
  assert.equal(tableData.length, 1)
  assert.equal(tableData[0].name, 'Kickoff Football Turf')

  // Excel export uses table data
  const rows = businessesToRows(tableData)
  assert.equal(rows.length, 1)
  assert.equal(rows[0].Name, 'Kickoff Football Turf')
  // Clearly distinguishes API data from application-inferred classification
  assert.equal(rows[0]['Google Primary Type (API)'], 'athletic_field')
  assert.equal(rows[0]['Google Place Types (API)'], 'athletic_field')
  assert.equal(rows[0]['Category Match (Inferred)'], 'ACCEPT')
  assert.equal(rows[0]['Validation Confidence (Inferred)'], 'HIGH')
  assert.equal(rows[0]['Validation Reason (Inferred)'], 'Commercial football turf.')

  // Needs Verification export
  const reviewRows = businessesToRows(mixedData.filter((b) => b.categoryValidation?.status === 'REVIEW'))
  assert.equal(reviewRows.length, 1)
  assert.equal(reviewRows[0].Name, 'Open Community Ground')
  assert.equal(reviewRows[0]['Category Match (Inferred)'], 'REVIEW')

  // Real Excel file generation check
  const XLSX = await import('xlsx')
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'xl-cat-'))
  const file = path.join(dir, 'category_export.xlsx')
  const ws = XLSX.utils.json_to_sheet(rows)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Businesses')
  fs.writeFileSync(file, XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }))

  const parsed = XLSX.utils.sheet_to_json(XLSX.read(fs.readFileSync(file)).Sheets.Businesses)
  assert.equal(parsed.length, 1)
  assert.equal(parsed[0]['Category Match (Inferred)'], 'ACCEPT')
  assert.equal(parsed[0]['Google Primary Type (API)'], 'athletic_field')
})
