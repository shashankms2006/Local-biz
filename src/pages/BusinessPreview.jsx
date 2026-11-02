import { Component, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Code2, Download, RefreshCw, X } from 'lucide-react'
import { chooseTemplate, templateById, WEBSITE_TEMPLATES } from '../websiteTemplates'
import { ScrollReveals } from '../WebsiteLayouts'
import { businessTemplateLayouts } from '../BusinessTemplateLayouts'
import { createZipBlob } from '../utils/zip'
import '../websiteTemplates.css'
import '../websiteMotion.css'
import '../businessTemplateDesigns.css'

function callNumber(phone) {
  const raw = String(phone || '').trim()
  const value = raw.replace(/[^\d+]/g, '')
  return /^\+?\d{7,15}$/.test(value) ? value : ''
}
function whatsappNumber(phone, country) {
  const raw = String(phone || '').trim()
  const digits = raw.replace(/\D/g, '')
  if (raw.startsWith('+') && digits.length >= 8 && digits.length <= 15) return digits
  if (country === 'India' && /^0?\d{10}$/.test(digits)) return `91${digits.replace(/^0/, '')}`
  if (country === 'United States' && /^\d{10}$/.test(digits)) return `1${digits}`
  if (country === 'United Kingdom' && /^0?\d{10}$/.test(digits)) return `44${digits.replace(/^0/, '')}`
  return ''
}
const mapUrl = (business) => business.mapUrl || (business.lat != null && business.lon != null ? `https://www.google.com/maps/search/?api=1&query=${business.lat},${business.lon}` : '')
const stockPhotos = {
  spa: ['1540555700478-4be289fbecef','1544161515-4ab6ce6db874','1570172619644-dfd03ed5d881','1519823551278-64ac92734fb1'],
  salon: ['1522337360788-8b13dee7a37e','1560066984-138dadb4c035','1521590832167-7bcbfaa6381f','1600948836101-f9ffda59d250'],
  gym: ['1534438327276-14e5300c3a48','1534258936925-c58bed479fcb','1583454110551-21f2fa2afe61','1517836357463-d25dfeac3438'],
  turf: ['1521412644187-c49fa049e84d','1574629810360-7efbbe195018','1517466787929-bc90951d0974','1522778119026-d647f0596c20'],
  travel: ['1464822759023-fed622ff2c3b','1500530855697-b586d89ba3ee','1476514525535-07fb3b4ae5f1','1501785888041-af3ef285b470'],
}
function illustrativePhotos(category) {
  return (stockPhotos[category] || stockPhotos.travel).map((id, index) => ({
    url: `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=1600&q=82&ixlib=rb-4.1.0`,
    alt: `Illustrative ${category} image ${index + 1}`,
  }))
}

class PreviewErrorBoundary extends Component {
  state = { error: null, componentStack: '' }
  static getDerivedStateFromError(error) { return { error } }
  componentDidCatch(error, info) {
    console.error('[preview] render error:', error, info?.componentStack)
    this.setState({ componentStack: info?.componentStack || '' })
  }
  render() {
    if (this.state.error) return <PreviewState title="This preview hit a rendering error" detail={`${this.state.error.name || 'Error'}: ${this.state.error.message || 'Unknown rendering error'}. ${this.state.componentStack || 'Return to Finder and build the preview again.'}`} />
    return this.props.children
  }
}

function PreviewState({ title, detail, loading = false }) {
  return <main className="preview-state"><span className={`preview-state-mark ${loading ? 'is-loading' : ''}`}><span/></span><p className="preview-state-label">BIZFINDER WEBSITE PREVIEW</p><h1>{title}</h1><p>{detail}</p><Link to="/finder">Return to Location Finder</Link></main>
}

export default function BusinessPreview() {
  const { id } = useParams()
  const [overrideTemplateId, setOverrideTemplateId] = useState(null)
  const [devOpen, setDevOpen] = useState(false)

  const { site, business, photos } = useMemo(() => {
    try {
      const s = JSON.parse(localStorage.getItem('generated_business_sites') || '{}')[decodeURIComponent(id)] || {}
      const storedBusinesses = JSON.parse(localStorage.getItem('biz_businesses') || '[]')
      const biz = s.business || storedBusinesses.find((b) => b.id === s.placeId) || null
      return { site: s, business: biz, photos: biz ? illustrativePhotos(s.category || biz.category) : [] }
    } catch { return { site: {}, business: null, photos: [] } }
  }, [id])

  if (!business) return <PreviewState title="Preview unavailable" detail="This preview was not saved in this browser. Open the business in Finder or Lead Tracker and click Build Preview again."/>
  if (!site.templateId) return <PreviewState title="Preview unavailable" detail="Template data is missing. Click Build again from Lead Tracker."/>

  const seed = site.seed || `${site.placeId}:${site.category}`
  const template = templateById(overrideTemplateId || site.templateId) || chooseTemplate(business.category, site.placeId, seed)

  const handleChangeTemplate = () => {
    const pool = WEBSITE_TEMPLATES.filter((t) => t.category === (business.category || site.category))
    const currentId = overrideTemplateId || site.templateId
    const idx = pool.findIndex((t) => t.id === currentId)
    const next = pool[(idx + 1) % pool.length]
    setOverrideTemplateId(next.id)
  }
  const theme = template.theme
  const Layout = businessTemplateLayouts[template.layout]
  if (!Layout) return <PreviewState title="This template is unavailable" detail="Return to Finder and generate a fresh preview."/>
  const phone = callNumber(business.phone)
  const waNumber = whatsappNumber(business.phone, business.country)
  const message = `Hello ${business.name}, I found your business online and I'm interested in your services. Could you please share more details and let me know how I can enquire or book?`
  const whatsapp = waNumber ? `https://wa.me/${waNumber}?text=${encodeURIComponent(message)}` : ''
  const maps = mapUrl(business)
  const address = business.address || [business.locality, business.city, business.state].filter(Boolean).join(', ')
  const props = { business, theme, photos: photos.filter((photo) => photo?.url || photo?.name), phone, whatsapp, maps, address }
  const style = { '--paper': theme.bg, '--ink': theme.ink, '--accent': theme.accent, '--muted': theme.muted, '--display': theme.display, '--body': theme.body }
  const handleDownloadZip = async () => {
    try {
      const siteElement = document.querySelector('.generated-site')
      if (!siteElement) throw new Error('The website preview is not ready yet.')
      const inlineStyles = [...document.querySelectorAll('style')].map((style) => style.textContent || '')
      const styleLinks = [...document.querySelectorAll('link[rel="stylesheet"]')]
      const linkedStyles = await Promise.all(styleLinks.map(async (link) => {
        const response = await fetch(link.href)
        if (!response.ok) throw new Error('Could not load the website styles for export.')
        return response.text()
      }))
      const styleText = [...inlineStyles, ...linkedStyles].join('\n').replace(/url\((['"]?)(\/[^)'"]+)\1\)/g, (_match, quote, path) => `url(${quote}${new URL(path, window.location.origin).href}${quote})`)
      const exportedSite = siteElement.cloneNode(true)
      exportedSite.querySelectorAll('.preview-export-controls').forEach((element) => element.remove())
      exportedSite.querySelector(':scope > footer')?.remove()
      exportedSite.querySelectorAll('.site-reveal').forEach((element) => element.classList.add('is-visible'))
      exportedSite.querySelectorAll('.site-scroll-reveal').forEach((element) => element.classList.add('is-inview'))
      const exportVisibilityStyles = '\n.site-reveal,.site-scroll-reveal{opacity:1!important;transform:none!important;visibility:visible!important}.site-image-skeleton{display:none!important}\n'
      const html = `<!doctype html>\n<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${business.name} | ${template.name}</title><meta name="description" content="${String(business.description || `${business.name} in ${address || 'your local area'}`).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char])}"><style>${styleText}${exportVisibilityStyles}</style></head><body>${exportedSite.outerHTML}</body></html>`
      const readme = `# ${business.name} website preview\n\nThis ZIP contains a static export of the preview website.\n\n## Run locally\n\n1. Extract this ZIP.\n2. Open \`index.html\` in a browser.\n3. If your browser restricts local files, run \`python -m http.server 8000\` in this folder and visit http://localhost:8000.\n\n## Publish\n\n- **Netlify:** extract the ZIP and drag the folder containing \`index.html\` into Netlify Drop.\n- **Vercel:** extract it, open a terminal in the folder, then run \`npx vercel --prod\` and follow the prompts.\n\nThe preview uses illustrative Unsplash photography, so an internet connection is needed to load those images. Check business details and contact links before publishing.\n`
      const blob = createZipBlob([{ name: 'index.html', content: html }, { name: 'README.md', content: readme }])
      const url = URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = `${business.name.trim().replace(/[^\w-]+/g, '-').replace(/^-|-$/g, '') || 'business'}-website.zip`
      anchor.click()
      window.setTimeout(() => URL.revokeObjectURL(url), 1000)
    } catch (error) {
      console.error('[preview] ZIP export failed:', error)
      window.alert(error.message || 'Could not create the website ZIP. Please try again.')
    }
  }

  return <PreviewErrorBoundary><>
    {/* Floating dev button */}
    <div style={{ position:'fixed', bottom:20, left:20, zIndex:1000 }}>
      {devOpen && (
        <div style={{
          position:'absolute', bottom:52, left:0,
          background:'rgba(15,23,42,0.92)', backdropFilter:'blur(8px)',
          border:'1px solid rgba(255,255,255,0.12)', borderRadius:12,
          padding:'0.6rem', display:'flex', flexDirection:'column', gap:'0.4rem', minWidth:190,
          boxShadow:'0 8px 32px rgba(0,0,0,0.4)'
        }}>
          <button
            onClick={() => { handleDownloadZip(); setDevOpen(false) }}
            style={{ display:'flex', alignItems:'center', gap:8, background:'rgba(255,255,255,0.08)', border:'none',
              borderRadius:8, padding:'0.55rem 0.85rem', color:'#f1f5f9', fontSize:'0.82rem', fontWeight:600, cursor:'pointer', whiteSpace:'nowrap' }}
          >
            <Download size={14}/> Download ZIP
          </button>
          <button
            onClick={() => { handleChangeTemplate(); setDevOpen(false) }}
            style={{ display:'flex', alignItems:'center', gap:8, background:'rgba(255,255,255,0.08)', border:'none',
              borderRadius:8, padding:'0.55rem 0.85rem', color:'#f1f5f9', fontSize:'0.82rem', fontWeight:600, cursor:'pointer', whiteSpace:'nowrap' }}
          >
            <RefreshCw size={14}/> Change Template
          </button>
        </div>
      )}
      <button
        onClick={() => setDevOpen((o) => !o)}
        title="Developer tools"
        style={{
          width:44, height:44, borderRadius:'50%', border:'1px solid rgba(255,255,255,0.2)',
          background:'rgba(15,23,42,0.55)', backdropFilter:'blur(6px)',
          color:'rgba(255,255,255,0.85)', cursor:'pointer',
          display:'flex', alignItems:'center', justifyContent:'center',
          boxShadow:'0 4px 16px rgba(0,0,0,0.3)', transition:'background 0.2s'
        }}
        onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(15,23,42,0.8)'}
        onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(15,23,42,0.55)'}
      >
        {devOpen ? <X size={18}/> : <Code2 size={18}/>}
      </button>
    </div>
    <main className={`generated-site business-template-layout template-${template.id} motion-${theme.motion}`} style={style}>
    <title>{business.name} | {template.name}</title>
    <meta name="description" content={business.description || `${business.name}${address ? ` in ${address}` : ''}. Find directions and contact details.`}/>
    <ScrollReveals motion={theme.motion}/>
    <Layout {...props}/>
    <footer><span>{business.name} · {template.name}</span><Link to="/finder">← Return to Location Finder</Link><span>Preview saved in this browser</span></footer>
  </main></></PreviewErrorBoundary>
}