import { useEffect, useState } from 'react'
import { Settings2, Info, CheckCircle2, XCircle, Loader2, KeyRound } from 'lucide-react'
import { getServerHealth } from '../utils/api'

export default function Settings() {
  const [health, setHealth] = useState({ state: 'loading' })

  useEffect(() => {
    let alive = true
    getServerHealth()
      .then((h) => alive && setHealth({ state: 'ok', ...h }))
      .catch((e) => alive && setHealth({ state: 'error', message: e.message }))
    return () => { alive = false }
  }, [])

  return (
    <div style={{ maxWidth: 700, margin: '0 auto' }}>
      <div className="card" style={{ padding: '2rem', marginBottom: '1.5rem' }}>
        <h2 style={{ margin: '0 0 1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '1rem', fontWeight: 700 }}>
          <Settings2 size={18} color="#6366f1" /> Data Source: {health.state === 'ok' ? health.providerName : '…'}
        </h2>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', fontSize: '0.9rem', marginBottom: '1rem' }}>
          {health.state === 'loading' && <><Loader2 size={16} className="animate-spin" /> Checking server…</>}
          {health.state === 'error' && <><XCircle size={16} color="#ef4444" /> <span>{health.message}</span></>}
          {health.state === 'ok' && health.configured && <><CheckCircle2 size={16} color="#10b981" /> <span>Server is running and a {health.providerName} API key is configured.</span></>}
          {health.state === 'ok' && !health.configured && <><XCircle size={16} color="#ef4444" /> <span>Server is running, but <code>GOOGLE_MAPS_API_KEY</code> is not set.</span></>}
        </div>

        <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 10, padding: '1rem', fontSize: '0.8rem', color: '#475569', lineHeight: 1.7 }}>
          <div style={{ fontWeight: 700, marginBottom: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
            <KeyRound size={13} /> How to set the key
          </div>
          Copy <code>.env.example</code> to <code>.env</code>, set <code>GOOGLE_MAPS_API_KEY=your key</code> (and enable “Places API (New)” in Google Cloud), then restart <code>npm run dev</code>.
          The key is read only by the local server and is never sent to the browser or stored in this app.
        </div>
      </div>

      <div className="card" style={{ padding: '1.5rem' }}>
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start' }}>
          <Info size={18} color="#6366f1" style={{ flexShrink: 0, marginTop: 2 }} />
          <div>
            <h4 style={{ margin: '0 0 0.5rem', fontSize: '0.875rem', fontWeight: 700 }}>About this tool</h4>
            <p style={{ margin: 0, fontSize: '0.8rem', color: '#64748b', lineHeight: 1.7 }}>
              Businesses come from the Google Places API (Text Search). Phone, website, hours and ratings are shown only when Google
              has them. Google offers no exact city boundary, so check rows marked “Verify location”. Lead data you save is stored in this browser only.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}