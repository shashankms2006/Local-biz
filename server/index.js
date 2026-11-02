import 'dotenv/config'
import express from 'express'
import path from 'node:path'
import fs from 'node:fs'
import { fileURLToPath } from 'node:url'
import { CATEGORY_DEFS } from './categories.js'
import { ApiError } from './errors.js'
import { createGoogleClient, searchCategoryGoogle, instantSearchGoogle, normaliseGoogleResult } from './google.js'
import { checkMany } from './websiteCheck.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const PORT = Number(process.env.PORT) || 3001
const CACHE_TTL_MS = 10 * 60 * 1000   // short in-memory cache only; nothing is written to disk

export function createApp({ google = createGoogleClient({ apiKey: process.env.GOOGLE_MAPS_API_KEY }), checker = checkMany } = {}) {
  const app = express()
  app.disable('x-powered-by')
  app.use(express.json({ limit: '100kb' }))

  const cache = new Map()
  const inflight = new Map()
  const cached = async (key, fn, { force = false, cacheValue = (v) => v, cacheResult = true } = {}) => {
    if (!force && cacheResult) {
      const hit = cache.get(key)
      if (hit && Date.now() - hit.t < CACHE_TTL_MS) return hit.v
    }
    if (inflight.has(key)) return inflight.get(key)
    const p = fn().then((v) => { if (cacheResult) cache.set(key, { t: Date.now(), v: cacheValue(v) }); return v }).finally(() => inflight.delete(key))
    inflight.set(key, p)
    return p
  }

  const bad = (message, code = 'BAD_INPUT') => new ApiError(code, message, 400)
  const num = (v, name, min, max) => {
    const n = Number(v)
    if (v === undefined || v === '' || !Number.isFinite(n) || n < min || n > max) throw bad(`Invalid ${name}.`)
    return n
  }

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true, provider: 'google', providerName: 'Google', configured: google.hasKey, categories: Object.keys(CATEGORY_DEFS) })
  })

  // Resolve temporary Places photo resource names server-side; never send the API key to browsers.
  app.get('/api/places/photo', async (req, res) => {
    const name = String(req.query.name || '')
    if (!/^places\/[^/]{1,200}\/photos\/[^/]{1,500}$/.test(name)) throw bad('Invalid Places photo reference.')
    if (!process.env.GOOGLE_MAPS_API_KEY) throw new ApiError('NO_KEY', 'Google Places is not configured.', 503)
    const width = Math.max(320, Math.min(1600, Number(req.query.width) || 1200))
    const upstream = await fetch(`https://places.googleapis.com/v1/${name}/media?maxWidthPx=${width}&key=${encodeURIComponent(process.env.GOOGLE_MAPS_API_KEY)}`, { redirect: 'follow' })
    if (!upstream.ok || !upstream.body) throw new ApiError('PHOTO_UNAVAILABLE', 'This Google Places photo is not available.', 502)
    res.set('Cache-Control', 'no-store')
    res.set('Content-Type', upstream.headers.get('content-type') || 'image/jpeg')
    res.set('X-Content-Type-Options', 'nosniff')
    res.end(Buffer.from(await upstream.arrayBuffer()))
  })

  app.get('/api/places/photos', async (req, res) => {
    const placeId = String(req.query.placeId || '')
    if (!/^[A-Za-z0-9_-]{5,200}$/.test(placeId)) throw bad('Invalid Place ID.')
    if (!process.env.GOOGLE_MAPS_API_KEY) throw new ApiError('NO_KEY', 'Google Places is not configured.', 503)
    const response = await fetch(`https://places.googleapis.com/v1/places/${encodeURIComponent(placeId)}?fields=photos&key=${encodeURIComponent(process.env.GOOGLE_MAPS_API_KEY)}`)
    if (!response.ok) throw new ApiError('PHOTO_UNAVAILABLE', 'Business photos are not available right now.', 502)
    const details = await response.json()
    res.set('Cache-Control', 'no-store')
    res.json({ photos: (details.photos || []).slice(0, 5).map((p) => ({ name:p.name, googleMapsUri:p.googleMapsUri, attributions:p.authorAttributions || [] })) })
  })

  app.get('/api/places/details', async (req, res) => {
    const placeId = String(req.query.placeId || '')
    const category = String(req.query.category || '')
    if (!/^[A-Za-z0-9_-]{5,200}$/.test(placeId)) throw bad('Invalid Place ID.')
    if (!CATEGORY_DEFS[category]) throw bad('Unsupported business category.', 'UNSUPPORTED_CATEGORY')
    const place = await google.getPlaceDetails(placeId)
    const business = normaliseGoogleResult(place, category)
    const { photos: _photos, ...businessWithoutPhotoNames } = business
    res.set('Cache-Control', 'no-store')
    res.json({
      business: businessWithoutPhotoNames,
      photos: (place.photos || []).slice(0, 5).map((photo) => ({
        name: photo.name,
        googleMapsUri: photo.googleMapsUri,
        attributions: photo.authorAttributions || [],
      })),
    })
  })

  // Step 1: turn a typed city into candidate places so ambiguous names can be confirmed.
  app.get('/api/places/resolve', async (req, res) => {
    const q = String(req.query.q || '').trim()
    if (q.length < 2 || q.length > 100) throw bad('Enter a city or district name (2–100 characters).')
    const places = await cached(`resolve:${q.toLowerCase()}`, () => google.resolvePlaces(q), { cacheResult: false })
    if (!places.length) throw new ApiError('NOT_FOUND', `Google could not find a city or district called "${q}". Check the spelling or add the state/country, e.g. "Mysuru, Karnataka".`, 404)
    res.json({ places })
  })

  // Step 2: search one category inside the confirmed place.
  app.get('/api/places/search', async (req, res) => {
    const categoryId = String(req.query.category || '')
    if (!CATEGORY_DEFS[categoryId]) throw bad(`Unsupported category "${categoryId.slice(0, 40)}". Use one of: ${Object.keys(CATEGORY_DEFS).join(', ')}.`, 'UNSUPPORTED_CATEGORY')
    const place = {
      label: String(req.query.label || '').slice(0, 200),
      lat: num(req.query.lat, 'latitude', -90, 90),
      lon: num(req.query.lon, 'longitude', -180, 180),
      viewport: null,
    }
    if (req.query.north !== undefined) {
      place.viewport = {
        north: num(req.query.north, 'north', -90, 90), south: num(req.query.south, 'south', -90, 90),
        east: num(req.query.east, 'east', -180, 180), west: num(req.query.west, 'west', -180, 180),
      }
    }
    const force = req.query.force === '1'
    const key = `search:${categoryId}:${place.lat.toFixed(4)},${place.lon.toFixed(4)}:${place.label}`
    res.json(await cached(key, () => searchCategoryGoogle({ client: google, place, categoryId }), {
      force,
      cacheResult: false,
    }))
  })

  // Website status checks (separate from the places search).
  app.post('/api/websites/check', async (req, res) => {
    const urls = Array.isArray(req.body?.urls) ? req.body.urls : null
    if (!urls || urls.length === 0 || urls.length > 25 || urls.some((u) => typeof u !== 'string' || u.length > 500)) {
      throw bad('Send between 1 and 25 website addresses.')
    }
    res.json({ results: await checker(urls) })
  })

  // Live search box: free-text query near a point.
  app.get('/api/places/instant', async (req, res) => {
    const q = String(req.query.q || '').trim().slice(0, 120)
    const lat = num(req.query.lat, 'latitude', -90, 90)
    const lon = num(req.query.lon, 'longitude', -180, 180)
    if (q.length < 2) throw bad('Query too short.')
    const key = `instant:${q.toLowerCase()}:${lat.toFixed(3)},${lon.toFixed(3)}`
    res.json({ results: await cached(key, () => instantSearchGoogle({ client: google, q, lat, lon }), { cacheResult: false }) })
  })

  app.use('/api', (_req, res) => res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Unknown API route.' } }))

  const dist = path.join(__dirname, '..', 'dist')
  if (fs.existsSync(dist)) {
    app.use(express.static(dist))
    app.get('/{*splat}', (_req, res) => res.sendFile(path.join(dist, 'index.html')))
  }

  // eslint-disable-next-line no-unused-vars
  app.use((err, _req, res, _next) => {
    if (err instanceof ApiError) {
      console.warn(`[api] ${err.code} (${err.status})`)       // never log request details: they involve the key
      return res.status(err.status).json({ error: { code: err.code, message: err.message } })
    }
    if (err?.type === 'entity.parse.failed') return res.status(400).json({ error: { code: 'BAD_INPUT', message: 'Invalid request body.' } })
    console.error('[api] unexpected error:', err?.name)
    res.status(500).json({ error: { code: 'INTERNAL', message: 'Something went wrong on the server.' } })
  })
  return app
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (!process.env.GOOGLE_MAPS_API_KEY) console.warn('⚠  GOOGLE_MAPS_API_KEY is not set. Copy .env.example to .env and add your key.')
  createApp().listen(PORT, '127.0.0.1', () => {
    console.log('Data source: Google Places (Google-only build)')
    console.log(`API server listening on http://127.0.0.1:${PORT}`)
  })
}