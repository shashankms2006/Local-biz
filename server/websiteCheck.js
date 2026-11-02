// Website status checker. Completely separate from the places search.
// Runs on the server because browsers cannot read cross-origin status codes (CORS).
import dns from 'node:dns/promises'
import net from 'node:net'

const SOCIAL_HOSTS = ['facebook.com', 'fb.com', 'instagram.com', 'wa.me', 'whatsapp.com', 'linktr.ee',
  'twitter.com', 'x.com', 'youtube.com', 'justdial.com', 'sulekha.com', 'google.com', 'g.page', 'goo.gl']
const BROWSER_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36'
const ALIVE_BUT_BLOCKING = new Set([401, 403, 405, 429, 999])
const TLS_CODES = /CERT|TLS|SSL|SELF_SIGNED|UNABLE_TO_VERIFY/i

export function isPrivateIp(ip) {
  if (net.isIPv4(ip)) {
    const [a, b] = ip.split('.').map(Number)
    return a === 0 || a === 10 || a === 127 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127) || a >= 224
  }
  if (net.isIPv6(ip)) {
    const l = ip.toLowerCase()
    if (l === '::1' || l === '::') return true
    if (l.startsWith('::ffff:')) return isPrivateIp(l.slice(7))
    return l.startsWith('fc') || l.startsWith('fd') || l.startsWith('fe8') || l.startsWith('fe9') || l.startsWith('fea') || l.startsWith('feb')
  }
  return true
}

export function isSocialHost(host) {
  return SOCIAL_HOSTS.some((h) => host === h || host.endsWith('.' + h))
}

function parseUrl(raw) {
  let s = String(raw || '').trim().split(';')[0].trim()
  if (!s) return null
  if (!/^https?:\/\//i.test(s)) s = 'https://' + s
  try { const u = new URL(s); return ['http:', 'https:'].includes(u.protocol) ? u : null } catch { return null }
}

async function assertPublicHost(url) {
  const port = url.port
  if (port && !['80', '443'].includes(port)) throw Object.assign(new Error('blocked port'), { blocked: true })
  const host = url.hostname.replace(/^\[|\]$/g, '')
  if (net.isIP(host)) { if (isPrivateIp(host)) throw Object.assign(new Error('blocked'), { blocked: true }); return }
  const addrs = await dns.lookup(host, { all: true })
  if (!addrs.length || addrs.some((a) => isPrivateIp(a.address))) throw Object.assign(new Error('blocked'), { blocked: true })
}

async function fetchStatus(startUrl, fetchImpl, timeoutMs) {
  let url = startUrl
  for (let hop = 0; hop < 5; hop++) {
    await assertPublicHost(url)
    const ctl = new AbortController()
    const timer = setTimeout(() => ctl.abort(), timeoutMs)
    try {
      const res = await fetchImpl(url, { method: 'GET', redirect: 'manual', signal: ctl.signal,
        headers: { 'User-Agent': BROWSER_UA, Accept: 'text/html,*/*;q=0.8' } })
      res.body?.cancel?.().catch(() => {})
      if ([301, 302, 303, 307, 308].includes(res.status) && res.headers.get('location')) {
        url = new URL(res.headers.get('location'), url)
        if (!['http:', 'https:'].includes(url.protocol)) return 400
        continue
      }
      return res.status
    } finally { clearTimeout(timer) }
  }
  return 508 // too many redirects (Loop Detected) -> treated as inactive
}

/** Returns { status: 'active'|'inactive'|'no_website', note } and never throws. */
export async function checkWebsite(raw, { fetchImpl = fetch, timeoutMs = 8000 } = {}) {
  if (!raw) return { status: 'no_website', note: '' }
  const url = parseUrl(raw)
  if (!url) return { status: 'inactive', note: 'Invalid web address' }
  if (isSocialHost(url.hostname.toLowerCase())) return { status: 'no_website', note: 'Only a social or listing page, not its own website' }

  const candidates = [url]
  if (url.protocol === 'https:') { const h = new URL(url); h.protocol = 'http:'; candidates.push(h) }
  let result = { status: 'inactive', note: 'Could not connect' }
  for (const u of candidates) {
    try {
      const code = await fetchStatus(u, fetchImpl, timeoutMs)
      if (code < 400 || ALIVE_BUT_BLOCKING.has(code)) return { status: 'active', note: ALIVE_BUT_BLOCKING.has(code) ? 'Site responded but blocks automated checks' : '' }
      result = { status: 'inactive', note: code === 508 ? 'Too many redirects' : `HTTP ${code}` }
    } catch (err) {
      const code = err?.cause?.code || err?.code || ''
      if (err?.blocked) return { status: 'inactive', note: 'Address not allowed' }
      if (err?.name === 'AbortError') result = { status: 'inactive', note: 'Timed out' }
      else if (code === 'ENOTFOUND' || code === 'EAI_AGAIN') result = { status: 'inactive', note: 'Domain not found' }
      else if (TLS_CODES.test(code)) result = { status: 'inactive', note: 'SSL certificate problem' }
      else result = { status: 'inactive', note: 'Could not connect' }
    }
  }
  return result
}

export async function checkMany(urls, opts = {}, concurrency = 8) {
  const out = {}
  const queue = [...new Set(urls)]
  await Promise.all(Array.from({ length: Math.min(concurrency, queue.length) }, async () => {
    while (queue.length) { const u = queue.shift(); out[u] = await checkWebsite(u, opts) }
  }))
  return out
}