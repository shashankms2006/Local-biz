import { useState, useEffect, useRef } from 'react'
import { toast } from 'react-hot-toast'
import useStore from '../store/useStore'
import { CATEGORIES } from '../utils/categories'
import { getValidMapUrl } from '../utils/api'
import { chooseTemplate } from '../websiteTemplates'
import {
  FileCode2, Eye, Download, Copy, ChevronLeft, Search,
  MapPin, Phone, Globe, Users, X, ChevronDown,
} from 'lucide-react'

// ─────────────────────────────────────────────────────────────────────────────
// TEMPLATE GENERATORS
// ─────────────────────────────────────────────────────────────────────────────

function getCategoryDefaults(category) {
  const defaults = {
    salon: {
      services: ['Hair Cut & Styling', 'Color & Highlights', 'Bridal Makeup', 'Facial & Cleanup', 'Nail Art', 'Threading & Waxing'],
      tagline: 'Your Ultimate Beauty Destination — Where Style Meets Elegance',
      badges: ['✨ Expert Stylists', '💅 Premium Products', '🌟 5-Star Rated'],
      icons: ['✂️','🎨','💄','🌸','💅','🧖'],
    },
    spa: {
      services: ['Swedish Massage', 'Deep Tissue Massage', 'Aromatherapy', 'Hot Stone Therapy', 'Body Scrub', 'Facial Treatment'],
      tagline: 'Rejuvenate Your Body, Mind & Soul — A Sanctuary of Wellness',
      badges: ['🌿 100% Natural', '🧘 Certified Therapists', '💆 Relaxing Ambience'],
      icons: ['🌸','💆','🪔','🛁','🌿','✨'],
    },
    gym: {
      services: ['Weight Training', 'Cardio Zone', 'Yoga & Meditation', 'Zumba Classes', 'Personal Training', 'Diet Consultation'],
      tagline: 'Transform Your Body. Elevate Your Life. — Join Today!',
      badges: ['💪 Modern Equipment', '🏆 Expert Trainers', '⚡ AC Facility'],
      icons: ['🏋️','🏃','🧘','💃','👟','🥗'],
    },
    turf: {
      services: ['Football Turf', 'Cricket Net', 'Badminton Court', 'Basketball Court', 'Birthday Events', 'Corporate Bookings'],
      tagline: 'Play Hard, Play Fair — Premium Sports Facility for Everyone',
      badges: ['⚽ Premium Turf', '💡 Floodlights', '🚿 Changing Rooms'],
      icons: ['⚽','🏏','🏸','🏀','🎂','🏢'],
    },
    travel: {
      services: ['Domestic Tours', 'International Packages', 'Honeymoon Specials', 'Adventure Tours', 'Group Tours', 'Visa Assistance'],
      tagline: 'Explore the World With Us — Unforgettable Journeys Await',
      badges: ['🌍 500+ Destinations', '🏨 Best Hotels', '💎 Custom Packages'],
      icons: ['🌏','🌐','💑','🏔️','👥','📋'],
    },
  }
  return defaults[category] || defaults.salon
}

const disclaimer = `<div style="background:linear-gradient(135deg,#fef3c7,#fde68a);border:2px solid #f59e0b;color:#92400e;text-align:center;padding:12px 16px;font-size:13px;font-weight:700;font-family:sans-serif;letter-spacing:0.02em;">
  ⚠️ PREVIEW ONLY — This is a draft site created for demonstration purposes only. Not the official website of this business.
</div>`

const baseStyles = (color) => `
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:'Segoe UI',system-ui,sans-serif;color:#1e293b;background:#fff;line-height:1.6}
a{text-decoration:none;color:inherit}
img{max-width:100%;display:block}
.hero{background:linear-gradient(135deg,${color}ee,${color}99);color:white;text-align:center;padding:80px 24px 60px;position:relative;overflow:hidden}
.hero::before{content:'';position:absolute;inset:0;background:url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.05'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")}
.hero h1{font-size:clamp(1.8rem,5vw,3rem);font-weight:800;margin-bottom:12px;line-height:1.2;position:relative}
.hero p{font-size:1.1rem;opacity:.9;max-width:600px;margin:0 auto 28px;position:relative}
.cta-group{display:flex;gap:12px;justify-content:center;flex-wrap:wrap;position:relative}
.wa-btn{background:#25D366;color:white;padding:14px 28px;border-radius:50px;font-size:1rem;font-weight:700;display:inline-flex;align-items:center;gap:8px;transition:transform .2s,box-shadow .2s;box-shadow:0 4px 15px rgba(37,211,102,.4)}
.wa-btn:hover{transform:translateY(-2px);box-shadow:0 8px 24px rgba(37,211,102,.5)}
.call-btn{background:white;color:${color};padding:14px 28px;border-radius:50px;font-size:1rem;font-weight:700;display:inline-flex;align-items:center;gap:8px;transition:transform .2s;box-shadow:0 4px 15px rgba(0,0,0,.15)}
.call-btn:hover{transform:translateY(-2px)}
.badge-strip{background:${color}12;border-top:1px solid ${color}22;border-bottom:1px solid ${color}22;padding:16px 24px;display:flex;justify-content:center;gap:32px;flex-wrap:wrap}
.badge-item{display:flex;align-items:center;gap:8px;font-size:.9rem;font-weight:700;color:${color}}
section{padding:60px 24px;max-width:1100px;margin:0 auto}
.sec-title{text-align:center;font-size:1.8rem;font-weight:800;margin-bottom:10px;color:#1e293b}
.sec-sub{text-align:center;color:#64748b;font-size:.98rem;margin-bottom:40px;max-width:580px;margin-left:auto;margin-right:auto}
.services-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:16px}
.service-card{background:#f8fafc;border-radius:14px;padding:24px 16px;text-align:center;border:1px solid #e2e8f0;transition:transform .2s,box-shadow .2s,border-color .2s}
.service-card:hover{transform:translateY(-4px);box-shadow:0 8px 24px rgba(0,0,0,.1);border-color:${color}44}
.service-icon{font-size:2rem;margin-bottom:10px}
.service-name{font-size:.88rem;font-weight:700;color:#1e293b}
.gallery{display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:12px}
.gallery-item{height:200px;border-radius:12px;background:linear-gradient(135deg,${color}18,${color}38);display:flex;align-items:center;justify-content:center;color:${color};font-weight:600;font-size:.82rem;border:2px dashed ${color}44;flex-direction:column;gap:6px}
.contact-section{background:linear-gradient(135deg,#f8fafc,#f1f5f9);border-radius:20px;padding:48px 32px;text-align:center}
.contact-grid{display:flex;flex-direction:column;gap:12px;align-items:center;margin:24px 0}
.contact-item{display:flex;align-items:center;gap:10px;font-size:1rem;color:#374151;font-weight:500}
.map-btn{display:inline-flex;align-items:center;gap:8px;background:${color};color:white;padding:12px 24px;border-radius:10px;font-weight:700;margin-top:12px;transition:opacity .2s,transform .2s}
.map-btn:hover{opacity:.88;transform:translateY(-1px)}
.social-links{display:flex;gap:12px;justify-content:center;margin-top:20px;flex-wrap:wrap}
.social-btn{padding:10px 22px;border-radius:50px;font-size:.875rem;font-weight:700;border:2px solid;transition:all .2s;display:inline-flex;align-items:center;gap:6px}
.social-btn:hover{transform:translateY(-1px)}
.hours-box{background:white;border-radius:12px;padding:20px 24px;display:inline-block;box-shadow:0 2px 12px rgba(0,0,0,.08);text-align:left;margin-top:16px;min-width:260px}
.hours-box pre{margin:8px 0 0;font-family:inherit;font-size:.9rem;color:#374151;white-space:pre-wrap}
footer{background:#1e293b;color:#94a3b8;text-align:center;padding:32px 24px;font-size:.85rem}
footer strong{color:white}
footer .preview-note{margin-top:8px;font-size:.75rem;color:#64748b}
@media(max-width:640px){.hero{padding:60px 16px 40px}.cta-group{flex-direction:column;align-items:center}.badge-strip{gap:16px}section{padding:40px 16px}.contact-section{padding:32px 20px}}
`

function buildHTML(category, data) {
  const d = getCategoryDefaults(category)
  const cat = CATEGORIES.find((c) => c.id === category)
  const color = cat?.color || '#6366f1'
  const emoji = cat?.emoji || '🏢'

  const name = data.businessName || 'Business Name'
  const tagline = data.tagline?.trim() || ''
  const phone = data.phone || ''
  const wa = data.whatsapp || data.phone || ''
  const waClean = wa.replace(/[\s\-()]/g, '')
  const email = data.email || ''
  const address = [data.address, data.city].filter(Boolean).join(', ')
  const description = data.description?.trim() || ''
  // Correct, valid Google Maps link
  const mapLink = data.mapLink?.trim() || getValidMapUrl(data)
  const instagram = data.instagram || ''
  const facebook = data.facebook || ''
  const openHours = data.openHours || ''

  const userServices = data.services
    ? data.services.split('\n').map((s) => s.trim()).filter(Boolean)
    : []
  // Only show services section if user has entered some
  const services = userServices

  const serviceCards = services.length > 0
    ? services.map((s, i) =>
        `<div class="service-card"><div class="service-icon">${d.icons[i % d.icons.length]}</div><div class="service-name">${s}</div></div>`
      ).join('')
    : ''
  const servicesSection = serviceCards
    ? `<section>
  <h2 class="sec-title">Our Services</h2>${description ? `\n  <p class="sec-sub">${description}</p>` : ''}\n  <div class="services-grid">${serviceCards}</div>\n</section>`
    : (description ? `<section><p class="sec-sub" style="text-align:center;margin-top:0">${description}</p></section>` : '')

  const galleryItems = Array(6).fill(0).map((_, i) =>
    `<div class="gallery-item"><span style="font-size:2rem">📷</span><span>Photo ${i + 1}</span></div>`
  ).join('')

  const badgeItems = d.badges.map((b) => `<div class="badge-item">${b}</div>`).join('')

  const contactItems = [
    address && `<div class="contact-item">📍 ${address}</div>`,
    phone && `<div class="contact-item"><a href="tel:${phone}" style="color:inherit">📞 ${phone}</a></div>`,
    email && `<div class="contact-item"><a href="mailto:${email}" style="color:inherit">✉️ ${email}</a></div>`,
  ].filter(Boolean).join('')

  const hoursSection = openHours
    ? `<div class="hours-box"><strong>🕐 Opening Hours</strong><pre>${openHours}</pre></div>`
    : ''

  const mapSection = mapLink
    ? `<a href="${mapLink}" target="_blank" rel="noopener noreferrer" class="map-btn">📍 Open in Google Maps</a>`
    : ''

  const socialSection = [
    instagram && `<a href="${instagram}" target="_blank" rel="noopener noreferrer" class="social-btn" style="color:#e1306c;border-color:#e1306c">📸 Instagram</a>`,
    facebook && `<a href="${facebook}" target="_blank" rel="noopener noreferrer" class="social-btn" style="color:#1877f2;border-color:#1877f2">👍 Facebook</a>`,
  ].filter(Boolean).join('')

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1.0"/>
<meta name="robots" content="noindex,nofollow"/>
<title>${name} — Preview</title>
<style>${baseStyles(color)}</style>
</head>
<body>

${disclaimer}

<div class="hero">
  <div style="font-size:3.5rem;margin-bottom:16px;position:relative">${emoji}</div>
  <h1>${name}</h1>
  ${tagline ? `<p>${tagline}</p>` : ''}
  <div class="cta-group">
    ${waClean ? `<a href="https://wa.me/${waClean}?text=Hello%2C%20I%20would%20like%20to%20enquire%20about%20your%20services." class="wa-btn">💬 WhatsApp Us</a>` : ''}
    ${phone ? `<a href="tel:${phone}" class="call-btn">📞 Call Now</a>` : ''}
  </div>
</div>

<div class="badge-strip">${badgeItems}</div>

${servicesSection}

<section style="padding-top:0">
  <h2 class="sec-title">Photo Gallery</h2>
  <p class="sec-sub">A glimpse of our work and facilities</p>
  <div class="gallery">${galleryItems}</div>
</section>

<section style="padding-top:0">
  <div class="contact-section">
    <h2 class="sec-title">Find Us</h2>
    <p class="sec-sub">Visit us or get in touch today</p>
    <div class="contact-grid">${contactItems}</div>
    ${hoursSection}
    ${mapSection}
    ${socialSection ? `<div class="social-links">${socialSection}</div>` : ''}
  </div>
</section>

${disclaimer}

<footer>
  <strong>${name}</strong>${data.city ? ' · ' + data.city : ''}<br/>
  <div class="preview-note">⚠️ This is a PREVIEW website created for demonstration purposes only. It is not the official website of ${name}.</div>
</footer>

</body>
</html>`
}

// ─────────────────────────────────────────────────────────────────────────────
// BUSINESS PICKER COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

function BusinessPicker({ onSelect }) {
  const businesses = useStore((s) => s.businesses)
  const leads      = useStore((s) => s.leads)
  const [query, setQuery]   = useState('')
  const [open, setOpen]     = useState(false)
  const [source, setSource] = useState('leads') // 'leads' | 'finder'
  const ref = useRef(null)

  // Close on outside click
  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const pool = source === 'leads' ? leads : businesses
  const filtered = pool.filter((b) =>
    !query || b.name?.toLowerCase().includes(query.toLowerCase()) ||
    b.city?.toLowerCase().includes(query.toLowerCase()) ||
    b.address?.toLowerCase().includes(query.toLowerCase())
  ).slice(0, 50)

  const handlePick = (biz) => {
    onSelect(biz)
    setOpen(false)
    setQuery('')
  }

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      {/* Trigger button */}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '0.65rem 0.9rem', border: '1px solid #e2e8f0', borderRadius: 8,
          background: 'white', cursor: 'pointer', fontSize: '0.875rem', color: '#374151',
          transition: 'border-color 0.2s',
        }}
      >
        <span style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#94a3b8' }}>
          <Search size={14} /> Pick a business to auto-fill details…
        </span>
        <ChevronDown size={14} />
      </button>

      {/* Dropdown */}
      {open && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0, zIndex: 200,
          background: 'white', border: '1px solid #e2e8f0', borderRadius: 12,
          boxShadow: '0 8px 32px rgba(0,0,0,0.15)', overflow: 'hidden',
        }}>
          {/* Source toggle */}
          <div style={{ display: 'flex', padding: '0.5rem', gap: '0.4rem', borderBottom: '1px solid #f1f5f9', background: '#f8fafc' }}>
            {[
              { id: 'leads', label: `Lead Tracker (${leads.length})`, icon: <Users size={12} /> },
              { id: 'finder', label: `Search Results (${businesses.length})`, icon: <MapPin size={12} /> },
            ].map((s) => (
              <button key={s.id} onClick={() => setSource(s.id)}
                style={{
                  flex: 1, padding: '0.35rem 0.5rem', borderRadius: 7, border: 'none',
                  background: source === s.id ? '#6366f1' : 'transparent',
                  color: source === s.id ? 'white' : '#64748b',
                  fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
                }}>
                {s.icon} {s.label}
              </button>
            ))}
          </div>

          {/* Search within picker */}
          <div style={{ padding: '0.5rem', borderBottom: '1px solid #f1f5f9' }}>
            <div style={{ position: 'relative' }}>
              <Search size={13} style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
              <input
                autoFocus
                className="input-field"
                style={{ paddingLeft: '1.75rem', fontSize: '0.82rem', padding: '0.45rem 0.75rem 0.45rem 1.75rem' }}
                placeholder="Search by name or city…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
          </div>

          {/* Business list */}
          <div style={{ maxHeight: 280, overflowY: 'auto' }}>
            {filtered.length === 0 ? (
              <div style={{ padding: '1.5rem', textAlign: 'center', color: '#94a3b8', fontSize: '0.82rem' }}>
                {pool.length === 0
                  ? source === 'leads'
                    ? 'No leads yet. Add businesses from the Finder first.'
                    : 'No search results yet. Go to Finder and search a city first.'
                  : 'No matches found.'}
              </div>
            ) : (
              filtered.map((biz) => {
                const cat = CATEGORIES.find((c) => c.id === biz.category)
                return (
                  <button
                    key={biz.id}
                    onClick={() => handlePick(biz)}
                    style={{
                      width: '100%', padding: '0.7rem 1rem', display: 'flex', alignItems: 'center',
                      gap: '0.75rem', border: 'none', background: 'none', cursor: 'pointer',
                      textAlign: 'left', transition: 'background 0.15s', borderBottom: '1px solid #f8fafc',
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.background = '#f8fafc'}
                    onMouseLeave={(e) => e.currentTarget.style.background = 'none'}
                  >
                    <span style={{ fontSize: '1.4rem', flexShrink: 0 }}>{cat?.emoji || '🏢'}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 700, fontSize: '0.875rem', color: '#1e293b',
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {biz.name}
                      </div>
                      <div style={{ fontSize: '0.72rem', color: '#94a3b8', marginTop: 2,
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {[cat?.label, biz.city || biz.address?.split(',')[0]].filter(Boolean).join(' · ')}
                      </div>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 3, alignItems: 'flex-end', flexShrink: 0 }}>
                      {biz.phone && <span style={{ fontSize: '0.7rem', color: '#3b82f6', display:'flex', alignItems:'center', gap:3 }}><Phone size={9}/>{biz.phone}</span>}
                      <span style={{ fontSize: '0.68rem', padding: '1px 6px', borderRadius: 99,
                        background: biz.websiteStatus === 'no_website' ? '#fef3c7' : '#f1f5f9',
                        color: biz.websiteStatus === 'no_website' ? '#92400e' : '#64748b', fontWeight: 600 }}>
                        {biz.websiteStatus === 'no_website' ? '⚡ No Website' : biz.websiteStatus === 'active' ? '🟢 Active' : '🔴 Inactive'}
                      </span>
                    </div>
                  </button>
                )
              })
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// FORM FIELD CONFIG (No placeholders)
// ─────────────────────────────────────────────────────────────────────────────

const FORM_FIELDS = [
  { key: 'businessName', label: 'Business Name *', required: true },
  { key: 'phone',        label: 'Phone Number' },
  { key: 'whatsapp',     label: 'WhatsApp Number' },
  { key: 'address',      label: 'Street Address' },
  { key: 'city',         label: 'City' },
  { key: 'openHours',    label: 'Opening Hours', multiline: true, rows: 3 },
  { key: 'mapLink',      label: 'Google Maps Link' },
]

// ─────────────────────────────────────────────────────────────────────────────
// MAIN TEMPLATES PAGE
// ─────────────────────────────────────────────────────────────────────────────

export default function Templates() {
  const selectedTemplate  = useStore((s) => s.selectedTemplate)
  const templateData      = useStore((s) => s.templateData)
  const setSelectedTemplate = useStore((s) => s.setSelectedTemplate)
  const setTemplateData   = useStore((s) => s.setTemplateData)

  const [formData, setFormData]       = useState({})
  const [previewHtml, setPreviewHtml] = useState('')
  const [showPreview, setShowPreview] = useState(false)
  const [pickedBiz, setPickedBiz]     = useState(null)
  const iframeRef = useRef(null)

  // Sync from store when navigating from Lead Tracker
  useEffect(() => {
    if (templateData && Object.keys(templateData).length > 0) {
      setFormData(templateData)
    }
  }, [])

  const updateField = (key, value) => {
    setFormData((prev) => ({ ...prev, [key]: value }))
  }

  // ── Auto-fill from business picker ───────────────────────────────────────
  const handleBusinessSelect = (biz) => {
    setPickedBiz(biz)

    // Set the template category to match the business
    if (biz.category) setSelectedTemplate(biz.category)

    const cat = CATEGORIES.find((c) => c.id === biz.category)
    const defaults = getCategoryDefaults(biz.category || 'salon')

    const filled = {
      businessName: biz.name || '',
      phone: biz.phone || '',
      whatsapp: biz.phone || '',
      email: biz.email || '',
      address: biz.address || '',
      city: biz.city || biz.locality || '',
      // Guaranteed valid Google Maps link
      mapLink: getValidMapUrl(biz),
      openHours: biz.openingHours
        ? biz.openingHours.replace(/;\s*/g, '\n')
        : '',
      website: biz.website || '',
      // Leave tagline and services BLANK so user fills them in themselves
      tagline: '',
      services: '',
      description: '',
      instagram: '',
      facebook: '',
    }

    setFormData(filled)
    setTemplateData(filled)
    toast.success(`✅ Auto-filled details for ${biz.name}!`)
  }

  const handleClearPick = () => {
    setPickedBiz(null)
    setFormData({})
    setTemplateData({})
  }

  const handleGenerate = () => {
    if (!selectedTemplate) return toast.error('Please select a category first')
    if (!formData.businessName?.trim()) return toast.error('Business name is required')

    if (pickedBiz) {
      const placeId = pickedBiz.providerId || (pickedBiz.id?.startsWith('g_') ? pickedBiz.id.slice(2) : '')
      if (!placeId) return toast.error('This saved business has no Google Place ID. Select a Finder result to open the business preview.')

      const key = placeId
      const sites = JSON.parse(localStorage.getItem('generated_business_sites') || '{}')
      const recent = JSON.parse(localStorage.getItem('recent_business_template_ids') || '[]')
      const seed = `${placeId}:${Date.now()}`
      const template = chooseTemplate(selectedTemplate, placeId, seed, recent.slice(0, 3))
      if (!template) return toast.error('No website template is available for this business category.')

      sites[key] = { placeId, category: selectedTemplate, seed, templateId: template.id, createdAt: new Date().toISOString() }
      localStorage.setItem('generated_business_sites', JSON.stringify(sites))
      localStorage.setItem('recent_business_template_ids', JSON.stringify([template.id, ...recent].slice(0, 12)))
      window.open(`${window.location.origin}/preview/${encodeURIComponent(key)}`, '_blank', 'noopener,noreferrer')
      return
    }

    const html = buildHTML(selectedTemplate, formData)
    setPreviewHtml(html)
    setShowPreview(true)
    setTemplateData(formData)
  }

  const handleDownload = () => {
    if (!previewHtml) return toast.error('Generate preview first')
    const blob = new Blob([previewHtml], { type: 'text/html' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href     = url
    a.download = `${(formData.businessName || 'preview').replace(/\s+/g, '_')}_website.html`
    a.click()
    URL.revokeObjectURL(url)
    toast.success('HTML file downloaded!')
  }

  const handleCopyHtml = () => {
    navigator.clipboard.writeText(previewHtml)
    toast.success('HTML copied to clipboard!')
  }

  // ── Preview mode ─────────────────────────────────────────────────────────
  if (showPreview && previewHtml) {
    return (
      <div style={{ display:'flex', flexDirection:'column', height:'calc(100vh - 64px)', gap:'1rem' }}>
        {/* Toolbar */}
        <div className="card" style={{ padding:'0.875rem 1.25rem', display:'flex', alignItems:'center',
          justifyContent:'space-between', gap:'1rem', flexWrap:'wrap', flexShrink:0 }}>
          <div style={{ display:'flex', alignItems:'center', gap:'0.75rem' }}>
            <button className="btn-secondary" onClick={() => setShowPreview(false)}
              style={{ fontSize:'0.82rem', padding:'0.4rem 0.9rem' }}>
              <ChevronLeft size={14} /> Back to Editor
            </button>
            <span style={{ fontSize:'0.875rem', fontWeight:700, color:'#1e293b' }}>
              {formData.businessName} — Website Preview
            </span>
            <span style={{ background:'#fef3c7', color:'#92400e', fontSize:'0.7rem', fontWeight:700,
              padding:'2px 8px', borderRadius:99, border:'1px solid #f59e0b' }}>
              ⚠️ PREVIEW MODE
            </span>
          </div>
          <div style={{ display:'flex', gap:'0.75rem' }}>
            <button className="btn-secondary" onClick={handleCopyHtml}
              style={{ fontSize:'0.82rem', padding:'0.4rem 0.9rem' }}>
              <Copy size={13} /> Copy HTML
            </button>
            <button className="btn-success" onClick={handleDownload}
              style={{ fontSize:'0.82rem', padding:'0.4rem 0.9rem' }}>
              <Download size={13} /> Download .html
            </button>
          </div>
        </div>
        {/* iframe */}
        <div style={{ flex:1, borderRadius:12, overflow:'hidden', boxShadow:'0 4px 24px rgba(0,0,0,0.12)' }}>
          <iframe ref={iframeRef} srcDoc={previewHtml}
            style={{ width:'100%', height:'100%', border:'none' }}
            title="Website Preview" sandbox="allow-same-origin" />
        </div>
      </div>
    )
  }

  // ── Editor mode ───────────────────────────────────────────────────────────
  return (
    <div style={{ maxWidth: 1100, margin: '0 auto' }}>
      <div style={{ display: 'grid', gridTemplateColumns: '340px 1fr', gap: '1.5rem', alignItems: 'start' }}>

        {/* LEFT: Category + What's included */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div className="card" style={{ padding: '1.5rem' }}>
            <h3 style={{ margin: '0 0 1rem', fontSize: '0.95rem', fontWeight: 700 }}>
              <FileCode2 size={15} style={{ display:'inline', verticalAlign:'middle', marginRight:6, color:'#6366f1' }} />
              1. Select Business Category
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {CATEGORIES.map((cat) => (
                <button key={cat.id} onClick={() => setSelectedTemplate(cat.id)}
                  style={{
                    display:'flex', alignItems:'center', gap:'0.75rem', padding:'0.8rem 0.9rem',
                    borderRadius:10, border: selectedTemplate === cat.id ? `2px solid ${cat.color}` : '2px solid #e2e8f0',
                    background: selectedTemplate === cat.id ? cat.bg : 'white',
                    cursor:'pointer', transition:'all 0.2s', textAlign:'left', width:'100%',
                  }}>
                  <span style={{ fontSize:'1.3rem' }}>{cat.emoji}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, fontSize: '0.875rem',
                      color: selectedTemplate === cat.id ? cat.color : '#1e293b' }}>
                      {cat.label}
                    </div>
                    <div style={{ fontSize: '0.72rem', color: '#94a3b8' }}>Mobile-responsive template</div>
                  </div>
                  {selectedTemplate === cat.id && (
                    <span style={{ color: cat.color, fontWeight: 700, fontSize: '0.75rem' }}>✓</span>
                  )}
                </button>
              ))}
            </div>
          </div>


        </div>

        {/* RIGHT: Business Picker + Form */}
        <div className="card" style={{ padding: '1.5rem' }}>
          <h3 style={{ margin: '0 0 1.25rem', fontSize: '0.95rem', fontWeight: 700 }}>
            2. Business Details
          </h3>

          {/* Business picker */}
          <div style={{ marginBottom: '1.25rem' }}>
            <label style={{ fontSize: '0.78rem', fontWeight: 700, color: '#374151', display:'block', marginBottom:'0.4rem' }}>
              🔗 Auto-fill from Saved Lead or Search Result
            </label>
            {pickedBiz ? (
              <div style={{
                display:'flex', alignItems:'center', gap:'0.75rem', padding:'0.75rem 1rem',
                background:'#f0fdf4', border:'1px solid #86efac', borderRadius:10,
              }}>
                <span style={{ fontSize:'1.3rem' }}>
                  {CATEGORIES.find((c) => c.id === pickedBiz.category)?.emoji || '🏢'}
                </span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700, fontSize: '0.875rem', color: '#166534' }}>{pickedBiz.name}</div>
                  <div style={{ fontSize: '0.72rem', color: '#16a34a' }}>
                    ✓ Details auto-filled — edit below if needed
                  </div>
                </div>
                <button onClick={handleClearPick}
                  style={{ background:'none', border:'none', cursor:'pointer', color:'#94a3b8', padding:4 }}>
                  <X size={15} />
                </button>
              </div>
            ) : (
              <BusinessPicker onSelect={handleBusinessSelect} />
            )}
          </div>

          <div style={{ height: 1, background: '#f1f5f9', margin: '0 0 1.25rem' }} />

          {/* Form fields */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem', maxHeight: '65vh', overflowY: 'auto', paddingRight: '0.25rem' }}>
            {FORM_FIELDS.map(({ key, label, multiline, rows, required }) => (
              <div key={key}>
                <label style={{ fontSize: '0.78rem', fontWeight: 600, color: '#374151', display:'block', marginBottom:'0.3rem' }}>
                  {label}
                </label>
                {multiline ? (
                  <textarea
                    className="input-field"
                    style={{ resize:'vertical', minHeight: rows ? rows * 22 + 16 : 72, fontFamily:'inherit', fontSize:'0.85rem' }}
                    value={formData[key] || ''}
                    onChange={(e) => updateField(key, e.target.value)}
                    rows={rows || 3}
                  />
                ) : (
                  <input
                    className="input-field"
                    style={{ fontSize: '0.85rem' }}
                    value={formData[key] || ''}
                    onChange={(e) => updateField(key, e.target.value)}
                    required={required}
                  />
                )}
              </div>
            ))}
          </div>

          {/* Generate button */}
          <button
            className="btn-primary"
            onClick={handleGenerate}
            disabled={!selectedTemplate}
            style={{ width:'100%', justifyContent:'center', marginTop:'1.25rem',
              padding:'0.8rem', fontSize:'0.95rem', fontWeight:700 }}
          >
            <Eye size={16} />
            {selectedTemplate ? 'Generate Preview Website' : 'Select a category first'}
          </button>
        </div>
      </div>
    </div>
  )
}