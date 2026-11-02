import { useState, useRef, useEffect } from 'react'
import { toast } from 'react-hot-toast'
import useStore from '../store/useStore'
import { CATEGORIES } from '../utils/categories'
import { validateBusinessCategory } from '../utils/categoryValidation'
import { chooseTemplate } from '../websiteTemplates'
import {
  resolveCity,
  fetchCategoryBusinesses,
  checkWebsites,
  computeLeadScore,
  computeLeadFactors,
  getLeadLabel,
  exportToExcel,
  instantSearch,
  getValidMapUrl,
} from '../utils/api'
import {
  Search, MapPin, Download, Filter, SortAsc, Globe, Phone, Mail,
  Plus, Loader2, AlertCircle, CheckCircle2, XCircle, MinusCircle,
  RefreshCw, ExternalLink, Clock, LayoutGrid, X, Info,
  MessageCircle, Navigation, ShieldCheck, Sparkles, Building2, FileCode2, Tag,
} from 'lucide-react'

function whatsappUrl(phone, country, businessName) {
  const raw = String(phone || '').trim()
  let digits = raw.replace(/\D/g, '')
  if (raw.startsWith('+') && digits.length >= 8 && digits.length <= 15) {
    // Explicit international number is unambiguous.
  } else if (country === 'India' && /^0?\d{10}$/.test(digits)) {
    digits = `91${digits.replace(/^0/, '')}`
  } else if (country === 'United States' && /^\d{10}$/.test(digits)) {
    digits = `1${digits}`
  } else if (country === 'United Kingdom' && /^0?\d{10}$/.test(digits)) {
    digits = `44${digits.replace(/^0/, '')}`
  } else return null
  const message = `Hi ${businessName || 'there'}, I can build a website for your business. Would you like me to share a preview?`
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`
}

// �?��?��?� Sub-components �?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?�

function WebsiteStatusBadge({ status }) {
  if (status === 'checking') return (
    <span style={{ display:'inline-flex', alignItems:'center', gap:4, fontSize:'0.72rem', color:'#94a3b8' }}>
      <Loader2 size={11} className="animate-spin" /> Checking…
    </span>
  )
  if (status === 'active') return (
    <span className="badge badge-active"><CheckCircle2 size={10} /> Active</span>
  )
  if (status === 'inactive') return (
    <span className="badge badge-inactive"><XCircle size={10} /> Inactive</span>
  )
  if (status === 'unknown') return (
    <span className="badge badge-nowebsite" title="The website check failed. Try searching again."><AlertCircle size={10} /> Check failed</span>
  )
  return <span className="badge badge-nowebsite"><MinusCircle size={10} /> No Website</span>
}

function LeadScoreBadge({ score }) {
  const label = getLeadLabel(score)
  return (
    <span className={`badge badge-${label}`} title={`Lead Score: ${score}/100`}>
      🎯 {score}
    </span>
  )
}

function BusinessDetailsModal({ biz, onClose, onAddLead, isAdded }) {
  if (!biz) return null
  const cat = CATEGORIES.find((c) => c.id === biz.category)
  const { score, factors } = computeLeadFactors(biz)
  const leadLabel = getLeadLabel(score)

  const handleBuildWebsite = () => {
    const key = biz.id
    const saved = JSON.parse(localStorage.getItem('generated_business_sites') || '{}')
    if (!saved[key] || !saved[key].business) {
      const seed = `${key}:${Date.now()}`
      const recent = JSON.parse(localStorage.getItem('recent_business_template_ids') || '[]')
      const template = chooseTemplate(biz.category, key, seed, recent.slice(0, 3))
      saved[key] = { placeId: biz.id, category: biz.category, seed, templateId: template.id, business: biz, createdAt: new Date().toISOString() }
      localStorage.setItem('recent_business_template_ids', JSON.stringify([template.id, ...recent].slice(0, 12)))
    }
    localStorage.setItem('generated_business_sites', JSON.stringify(saved))
    onClose()
    window.open(`${window.location.origin}/preview/${encodeURIComponent(key)}`, '_blank', 'noopener,noreferrer')
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 999,
      backgroundColor: 'rgba(15, 23, 42, 0.65)', backdropFilter: 'blur(4px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem',
      animation: 'fadeIn 0.2s ease-out'
    }}>
      <div style={{
        background: '#ffffff', borderRadius: 16, width: '100%', maxWidth: 640,
        maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 40px -15px rgba(0,0,0,0.25)',
        border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column'
      }}>
        {/* Header */}
        <div style={{
          padding: '1.25rem 1.5rem', borderBottom: '1px solid #f1f5f9',
          display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '1rem'
        }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, flexWrap: 'wrap' }}>
              <span style={{
                background: cat?.bg || '#ede9fe', color: cat?.color || '#6366f1',
                padding: '2px 8px', borderRadius: 99, fontSize: '0.75rem', fontWeight: 700,
                display: 'inline-flex', alignItems: 'center', gap: 4
              }}>
                {cat?.emoji} {cat?.label}
              </span>
              {biz.locality && (
                <span style={{
                  background: '#f1f5f9', color: '#475569', padding: '2px 8px',
                  borderRadius: 99, fontSize: '0.75rem', fontWeight: 600,
                  display: 'inline-flex', alignItems: 'center', gap: 3
                }}>
                  <MapPin size={11} color="#64748b" /> {biz.locality}
                </span>
              )}
              {biz.distanceMeters != null && (
                <span style={{
                  background: '#f8fafc', color: '#64748b', padding: '2px 8px',
                  borderRadius: 99, fontSize: '0.75rem', fontWeight: 500
                }}>
                  <Navigation size={12} aria-hidden="true" /> {(biz.distanceMeters / 1000).toFixed(1)} km away
                </span>
              )}
            </div>
            <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800, color: '#0f172a', lineHeight: 1.3 }}>
              {biz.name}
            </h2>
          </div>
          <button
            onClick={onClose}
            style={{
              background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8,
              width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', color: '#64748b', transition: 'all 0.15s'
            }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Body content */}
        <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          
          {/* Lead score & outreach recommendation */}
          <div style={{
            background: score >= 70 ? '#f0fdf4' : score >= 40 ? '#fffbeb' : '#f8fafc',
            border: `1px solid ${score >= 70 ? '#bbf7d0' : score >= 40 ? '#fde68a' : '#e2e8f0'}`,
            borderRadius: 12, padding: '1rem 1.25rem'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, flexWrap: 'wrap', gap: 6 }}>
              <span style={{ fontSize: '0.82rem', fontWeight: 700, color: score >= 70 ? '#15803d' : score >= 40 ? '#b45309' : '#475569', display: 'flex', alignItems: 'center', gap: 6 }}>
                <Sparkles size={14} /> Lead Outreach Analysis
              </span>
              <span className={`badge badge-${leadLabel}`} style={{ fontSize: '0.8rem', padding: '3px 10px' }}>
                🎯 Score: {score}/100 ({leadLabel.toUpperCase()})
              </span>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
              {factors.map((f, i) => (
                <span key={i} style={{
                  fontSize: '0.75rem', fontWeight: 600, padding: '2px 8px', borderRadius: 6,
                  background: f.type === 'high' ? '#fef3c7' : f.type === 'medium' ? '#ffedd5' : '#e2e8f0',
                  color: f.type === 'high' ? '#92400e' : f.type === 'medium' ? '#9a3412' : '#334155'
                }}>
                  +{f.points} {f.label}
                </span>
              ))}
            </div>
          </div>

          {/* Category Classification & Google Places Types */}
          <div style={{ background: '#f8fafc', borderRadius: 12, padding: '1rem', border: '1px solid #f1f5f9' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, flexWrap: 'wrap', gap: 6 }}>
              <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'flex', alignItems: 'center', gap: 5 }}>
                <ShieldCheck size={13} color="#6366f1" /> Category Classification &amp; Google Types
              </label>
              <span style={{ fontSize: '0.7rem', color: '#94a3b8' }}>
                Application-Inferred vs. API Data
              </span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.75rem' }}>
              <div>
                <span style={{ fontSize: '0.72rem', color: '#94a3b8', display: 'block' }}>Validation Status (Inferred)</span>
                <span style={{
                  fontSize: '0.85rem', fontWeight: 700,
                  color: biz.categoryValidation?.status === 'ACCEPT' ? '#15803d' : biz.categoryValidation?.status === 'REJECT' ? '#b91c1c' : '#b45309',
                  display: 'inline-flex', alignItems: 'center', gap: 4
                }}>
                  {biz.categoryValidation?.status === 'ACCEPT' ? '✓ ACCEPTED' : biz.categoryValidation?.status === 'REJECT' ? '✗ REJECTED' : '⚠︝? NEEDS REVIEW'}
                  <span style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 500 }}>
                    ({biz.categoryValidation?.confidence || 'MED'} confidence)
                  </span>
                </span>
              </div>

              <div>
                <span style={{ fontSize: '0.72rem', color: '#94a3b8', display: 'block' }}>Google Primary Type (API)</span>
                <span style={{ fontSize: '0.85rem', color: '#1e293b', fontWeight: 600, fontFamily: 'monospace' }}>
                  {biz.primaryType || 'Not specified by API'}
                </span>
              </div>
            </div>

            {biz.categoryValidation?.reason && (
              <div style={{ marginTop: 8, fontSize: '0.78rem', color: '#334155', background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 8, padding: '6px 10px' }}>
                <strong>Validation Reason:</strong> {biz.categoryValidation.reason}
              </div>
            )}

            {biz.types && biz.types.length > 0 && (
              <div style={{ marginTop: 8 }}>
                <span style={{ fontSize: '0.72rem', color: '#94a3b8', display: 'block', marginBottom: 4 }}>
                  All Place Types from Google Places API:
                </span>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                  {biz.types.map((t, idx) => (
                    <span key={idx} style={{ fontSize: '0.7rem', fontFamily: 'monospace', background: '#e2e8f0', color: '#334155', padding: '1px 6px', borderRadius: 4 }}>
                      {t}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Subcategories & commercial tags */}
          {biz.subcategories && biz.subcategories.length > 0 && (
            <div>
              <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: 6 }}>
                Categories & Taxonomy Tags
              </label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {biz.subcategories.map((sub, i) => (
                  <span key={i} style={{
                    fontSize: '0.78rem', background: '#f1f5f9', color: '#334155',
                    padding: '3px 10px', borderRadius: 99, fontWeight: 500, border: '1px solid #e2e8f0'
                  }}>
                    <Tag size={12} style={{ verticalAlign:'-2px', marginRight:4 }} aria-hidden="true" />{sub}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Location & Address Details */}
          <div style={{ background: '#f8fafc', borderRadius: 12, padding: '1rem', border: '1px solid #f1f5f9' }}>
            <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'flex', alignItems: 'center', gap: 5, marginBottom: 8 }}>
              <MapPin size={13} color="#6366f1" /> Location & Address Details
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.75rem' }}>
              <div>
                <span style={{ fontSize: '0.72rem', color: '#94a3b8', display: 'block' }}>Full Address</span>
                <span style={{ fontSize: '0.85rem', color: '#1e293b', fontWeight: 600 }}>{biz.address || 'Not available'}</span>
              </div>
              {biz.locality && (
                <div>
                  <span style={{ fontSize: '0.72rem', color: '#94a3b8', display: 'block' }}>Area / Locality</span>
                  <span style={{ fontSize: '0.85rem', color: '#1e293b', fontWeight: 600 }}>{biz.locality}</span>
                </div>
              )}
              {biz.city && (
                <div>
                  <span style={{ fontSize: '0.72rem', color: '#94a3b8', display: 'block' }}>City / District</span>
                  <span style={{ fontSize: '0.85rem', color: '#1e293b', fontWeight: 600 }}>{biz.city}</span>
                </div>
              )}
              {biz.state && (
                <div>
                  <span style={{ fontSize: '0.72rem', color: '#94a3b8', display: 'block' }}>State / Region</span>
                  <span style={{ fontSize: '0.85rem', color: '#1e293b', fontWeight: 600 }}>{biz.state}</span>
                </div>
              )}
              {biz.postalCode && (
                <div>
                  <span style={{ fontSize: '0.72rem', color: '#94a3b8', display: 'block' }}>Postal / PIN Code</span>
                  <span style={{ fontSize: '0.85rem', color: '#1e293b', fontWeight: 600 }}>{biz.postalCode}</span>
                </div>
              )}
              {biz.lat && biz.lon && (
                <div>
                  <span style={{ fontSize: '0.72rem', color: '#94a3b8', display: 'block' }}>GPS Coordinates</span>
                  <span style={{ fontSize: '0.82rem', color: '#64748b', fontFamily: 'monospace' }}>
                    {biz.lat.toFixed(5)}, {biz.lon.toFixed(5)}
                  </span>
                </div>
              )}
            </div>

            {biz.lat && biz.lon && (
              <a
                href={biz.mapUrl || `https://www.google.com/maps/search/?api=1&query=${biz.lat},${biz.lon}`}
                target="_blank" rel="noopener noreferrer"
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6, marginTop: 12,
                  fontSize: '0.8rem', fontWeight: 600, color: '#3b82f6', textDecoration: 'none',
                  background: '#eff6ff', padding: '6px 12px', borderRadius: 8, border: '1px solid #bfdbfe'
                }}
              >
                <Navigation size={13} /> Find on Google Maps (name + city) <ExternalLink size={11} />
              </a>
            )}
            {biz.pinUrl && (
              <a href={biz.pinUrl} target="_blank" rel="noopener noreferrer"
                style={{ display:'inline-flex', alignItems:'center', gap:6, marginTop:12, marginLeft:8,
                  fontSize:'0.8rem', fontWeight:600, color:'#64748b', textDecoration:'none',
                  background:'#f8fafc', padding:'6px 12px', borderRadius:8, border:'1px solid #e2e8f0' }}>
                <MapPin size={13} /> Map pin <ExternalLink size={11} />
              </a>
            )}
            {biz.locationCheck && (biz.locationCheck.reasons.length > 0 || biz.locationCheck.notes.length > 0) && (
              <div style={{ marginTop:12, background: biz.locationCheck.level === 'check' ? '#fffbeb' : '#f8fafc',
                border:`1px solid ${biz.locationCheck.level === 'check' ? '#fde68a' : '#e2e8f0'}`, borderRadius:8,
                padding:'8px 12px', fontSize:'0.76rem', color:'#475569' }}>
                <strong>{biz.locationCheck.level === 'check' ? 'Verify this location before contacting.' : 'Notes:'}</strong>
                <ul style={{ margin:'4px 0 0', paddingLeft:'1.1rem' }}>
                  {[...biz.locationCheck.reasons, ...biz.locationCheck.notes].map((t) => <li key={t}>{t}</li>)}
                </ul>
                <div style={{ marginTop:4 }}>Compare the "Find on Google Maps" result with the address above. If they differ, trust Google Maps and the owner.</div>
              </div>
            )}
          </div>

          {/* Contact Details & Web Presence */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem' }}>
            <div style={{ background: '#f8fafc', borderRadius: 12, padding: '1rem', border: '1px solid #f1f5f9' }}>
              <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'flex', alignItems: 'center', gap: 5, marginBottom: 8 }}>
                <Phone size={13} color="#10b981" /> Phone & Contact
              </label>
              {biz.phones && biz.phones.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {biz.phones.map((p, idx) => (
                    <div key={idx} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
                      <a href={`tel:${p}`} style={{ fontSize: '0.85rem', color: '#2563eb', fontWeight: 600, textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 5 }}>
                        <Phone size={12} /> {p}
                      </a>
                      {whatsappUrl(p, biz.country, biz.name) && <a href={whatsappUrl(p, biz.country, biz.name)} target="_blank" rel="noopener noreferrer"
                        style={{ fontSize: '0.72rem', background: '#25d366', color: 'white', padding: '2px 8px', borderRadius: 6, textDecoration: 'none', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                        <MessageCircle size={10} /> WhatsApp
                      </a>}
                    </div>
                  ))}
                </div>
              ) : biz.phone ? (
                <a href={`tel:${biz.phone}`} style={{ fontSize: '0.85rem', color: '#2563eb', fontWeight: 600, textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 5 }}>
                  <Phone size={12} /> {biz.phone}
                </a>
              ) : (
                <span style={{ fontSize: '0.82rem', color: '#94a3b8' }}>No phone number on record</span>
              )}
            </div>

            <div style={{ background: '#f8fafc', borderRadius: 12, padding: '1rem', border: '1px solid #f1f5f9' }}>
              <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'flex', alignItems: 'center', gap: 5, marginBottom: 8 }}>
                <Globe size={13} color="#6366f1" /> Online Presence
              </label>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                <WebsiteStatusBadge status={biz.websiteStatus} />
              </div>
              {biz.website ? (
                <div>
                  <a href={biz.website.startsWith('http') ? biz.website : 'https://' + biz.website}
                    target="_blank" rel="noopener noreferrer"
                    style={{ fontSize: '0.82rem', color: '#6366f1', fontWeight: 600, textDecoration: 'none', wordBreak: 'break-all', display: 'flex', alignItems: 'center', gap: 4 }}>
                    {biz.website} <ExternalLink size={11} />
                  </a>
                  {biz.websiteNote && (
                    <div style={{ fontSize: '0.72rem', color: '#ef4444', marginTop: 4 }}>
                      ⚠︝? {biz.websiteNote}
                    </div>
                  )}
                </div>
              ) : (
                <div style={{ fontSize: '0.8rem', color: '#b45309', fontWeight: 600 }}>
                  ⚡ No website exists ”? Great opportunity to pitch a modern site!
                </div>
              )}
            </div>
          </div>

          {/* Operating hours */}
          <div style={{ background: '#f8fafc', borderRadius: 12, padding: '1rem', border: '1px solid #f1f5f9' }}>
            <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'flex', alignItems: 'center', gap: 5, marginBottom: 6 }}>
              <Clock size={13} color="#f59e0b" /> Operating Hours
            </label>
            {biz.openingHours ? (
              <div style={{ fontSize: '0.82rem', color: '#334155', fontWeight: 500, lineHeight: 1.5 }}>
                {biz.openingHours}
              </div>
            ) : (
              <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>
                Standard commercial operating hours (not explicitly listed in public registry)
              </span>
            )}
          </div>
        </div>

        {/* Footer actions */}
        <div style={{
          padding: '1rem 1.5rem', borderTop: '1px solid #f1f5f9', background: '#fafafa',
          borderRadius: '0 0 16px 16px', display: 'flex', flexWrap: 'wrap', gap: '0.75rem', justifyContent: 'flex-end'
        }}>
          <button
            className="btn-secondary"
            onClick={onClose}
            style={{ fontSize: '0.85rem', padding: '0.5rem 1rem' }}
          >
            Close
          </button>
          <button
            className="btn-secondary"
            onClick={handleBuildWebsite}
            style={{ fontSize: '0.85rem', padding: '0.5rem 1rem', color: '#6366f1', borderColor: '#c7d2fe' }}
          >
            <FileCode2 size={14} /> Build Preview Website
          </button>
          <button
            className={isAdded ? 'btn-secondary' : 'btn-primary'}
            onClick={() => !isAdded && onAddLead(biz)}
            disabled={isAdded}
            style={{ fontSize: '0.85rem', padding: '0.5rem 1.25rem', opacity: isAdded ? 0.7 : 1 }}
          >
            {isAdded ? '✓ In Lead Tracker' : <><Plus size={14} /> Add to Lead Tracker</>}
          </button>
        </div>
      </div>
    </div>
  )
}

function BusinessCard({ biz, onAddLead, alreadyAdded, onOpenDetails, selected, onToggleSelect }) {
  const cat = CATEGORIES.find((c) => c.id === biz.category)
  return (
    <div className="biz-card fade-in" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', outline: selected ? '2px solid #6366f1' : 'none', outlineOffset: -2 }}>
      <div>
        <div style={{ position:'absolute', top:0, left:0, right:0, height:3,
          background: cat?.color || '#6366f1', borderRadius:'12px 12px 0 0' }} />
        <input type="checkbox" checked={!!selected} onChange={onToggleSelect} onClick={(e) => e.stopPropagation()}
          style={{ position:'absolute', top:10, right:10, width:15, height:15, cursor:'pointer', accentColor:'#6366f1' }} />

        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', gap:'0.5rem', marginTop:6 }}>
          <div style={{ flex:1, minWidth:0 }}>
            <div style={{ display:'flex', alignItems:'center', gap:5, marginBottom:4, flexWrap:'wrap' }}>
              <span style={{ fontSize:'0.72rem', fontWeight:700, color: cat?.color,
                background: cat?.bg, padding:'1px 8px', borderRadius:99 }}>
                {cat?.emoji} {cat?.label}
              </span>
              {biz.locality && (
                <span style={{ fontSize:'0.7rem', fontWeight:600, color:'#475569',
                  background:'#f1f5f9', padding:'1px 7px', borderRadius:99 }}>
                  <MapPin size={12} aria-hidden="true" /> {biz.locality}
                </span>
              )}
              {biz.distanceMeters != null && (
                <span style={{ fontSize:'0.68rem', color:'#94a3b8' }}>
                  {(biz.distanceMeters / 1000).toFixed(1)}km
                </span>
              )}
            </div>
            <h3
              onClick={onOpenDetails}
              style={{ margin:'0 0 0.2rem', fontSize:'0.95rem', fontWeight:700, color:'#1e293b',
                overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', cursor:'pointer' }}
              title="Click to view all details"
            >
              {biz.name}
            </h3>
            {biz.address && (
              <p style={{ margin:'0 0 0.5rem', fontSize:'0.75rem', color:'#64748b',
                display:'flex', alignItems:'flex-start', gap:3, lineHeight:1.4 }}>
                <MapPin size={11} style={{ marginTop:2, flexShrink:0 }} />
                <span style={{ overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{biz.address}</span>
              </p>
            )}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: '0.4rem' }}>
              {biz.categoryValidation && (
                <span title={`Application Inferred: ${biz.categoryValidation.reason} (Confidence: ${biz.categoryValidation.confidence})`}
                  style={{ display:'inline-flex', alignItems:'center', gap:4, fontSize:'0.68rem', fontWeight:700,
                    color: biz.categoryValidation.status === 'ACCEPT' ? '#047857' : '#92400e',
                    background: biz.categoryValidation.status === 'ACCEPT' ? '#ecfdf5' : '#fef3c7',
                    border: `1px solid ${biz.categoryValidation.status === 'ACCEPT' ? '#a7f3d0' : '#fde68a'}`,
                    borderRadius:99, padding:'1px 8px' }}>
                  {biz.categoryValidation.status === 'ACCEPT' ? <CheckCircle2 size={10} /> : <AlertCircle size={10} />}
                  {biz.categoryValidation.status === 'ACCEPT' ? 'Category Verified' : 'Needs Verification'}
                </span>
              )}
              {biz.locationCheck?.level === 'check' && (
                <span title={biz.locationCheck.reasons.join('\n')}
                  style={{ display:'inline-flex', alignItems:'center', gap:4, fontSize:'0.68rem', fontWeight:700,
                    color:'#92400e', background:'#fef3c7', border:'1px solid #fde68a', borderRadius:99,
                    padding:'1px 8px' }}>
                  <AlertCircle size={10} /> Verify location
                </span>
              )}
            </div>
          </div>
          <LeadScoreBadge score={biz.leadScore} />
        </div>

        {/* Subcategories tags */}
        {biz.subcategories && biz.subcategories.length > 0 && (
          <div style={{ display:'flex', gap:4, flexWrap:'wrap', marginBottom:'0.5rem' }}>
            {biz.subcategories.slice(0, 2).map((s, idx) => (
              <span key={idx} style={{ fontSize:'0.68rem', color:'#64748b', background:'#f8fafc',
                border:'1px solid #e2e8f0', padding:'1px 6px', borderRadius:4 }}>
                {s}
              </span>
            ))}
            {biz.subcategories.length > 2 && (
              <span style={{ fontSize:'0.68rem', color:'#94a3b8' }}>
                +{biz.subcategories.length - 2}
              </span>
            )}
          </div>
        )}

        <div style={{ display:'flex', flexWrap:'wrap', gap:'0.4rem', marginBottom:'0.6rem' }}>
          <WebsiteStatusBadge status={biz.websiteStatus} />
          {biz.openingHours ? (
            <span title={biz.openingHours} style={{ fontSize:'0.7rem', color:'#64748b', display:'flex', alignItems:'center', gap:3 }}>
              <Clock size={10} /> {biz.openingHours.length > 25 ? biz.openingHours.slice(0,25)+'…' : biz.openingHours}
            </span>
          ) : (
            <span style={{ fontSize:'0.7rem', color:'#94a3b8', display:'flex', alignItems:'center', gap:3 }}>
              <Clock size={10} /> Hours: Available
            </span>
          )}
        </div>

        <div style={{ display:'flex', flexDirection:'column', gap:'0.25rem', marginBottom:'0.75rem' }}>
          {biz.phone ? (
            <a href={`tel:${biz.phone}`} style={{ fontSize:'0.8rem', color:'#3b82f6', textDecoration:'none',
              display:'flex', alignItems:'center', gap:5 }}>
              <Phone size={12} /> {biz.phone}
            </a>
          ) : (
            <span style={{ fontSize:'0.75rem', color:'#94a3b8' }}>Phone: Not available</span>
          )}
          {biz.website ? (
            <a href={biz.website.startsWith('http') ? biz.website : 'https://'+biz.website}
              target="_blank" rel="noopener noreferrer"
              style={{ fontSize:'0.75rem', color:'#6366f1', textDecoration:'none',
                display:'flex', alignItems:'center', gap:4 }}>
              <Globe size={11} />
              <span style={{ overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', maxWidth:180 }}>
                {biz.website.replace(/^https?:\/\//,'')}
              </span>
              <ExternalLink size={9} />
            </a>
          ) : (
            <span style={{ fontSize:'0.75rem', color:'#f59e0b', fontWeight:600 }}>⚡ No website ”? High potential!</span>
          )}
        </div>
      </div>

      <div style={{ display:'flex', gap:'0.5rem', marginTop:'0.5rem' }}>
        {/* Valid Google Maps link directly opens place on Google Maps */}
        <a
          href={getValidMapUrl(biz)}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
            fontSize: '0.8rem', fontWeight: 600, color: '#2563eb', textDecoration: 'none',
            background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 8, padding: '0.42rem 0.6rem',
            transition: 'background 0.15s'
          }}
          title="Open place on Google Maps"
        >
          <Navigation size={12} /> Google Maps
        </a>
        <button
          className={alreadyAdded ? 'btn-secondary' : 'btn-primary'}
          onClick={() => !alreadyAdded && onAddLead(biz)}
          disabled={alreadyAdded}
          style={{ flex:1.2, justifyContent:'center', fontSize:'0.8rem', padding:'0.42rem 0.6rem',
            opacity: alreadyAdded ? 0.6 : 1 }}
        >
          {alreadyAdded ? '✓ Added' : <><Plus size={13} /> Add Lead</>}
        </button>
      </div>
    </div>
  )
}

// �?��?��?� Category loading status pill �?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?�
function CategoryPill({ cat, status, count, isActive, onClick }) {
  const isLoading = status === 'loading' || status === 'retrying'
  const statusColor = status === 'done' ? cat.color : isLoading ? '#94a3b8' : '#ef4444'
  const statusBg = status === 'done' ? cat.bg : isLoading ? '#f8fafc' : '#fee2e2'

  return (
    <button
      onClick={onClick}
      style={{
        display:'flex', alignItems:'center', gap:6,
        padding:'0.4rem 0.85rem', borderRadius:99, border:'none', cursor:'pointer',
        background: isActive ? cat.color : statusBg,
        color: isActive ? 'white' : '#374151',
        fontSize:'0.8rem', fontWeight:600,
        transition:'all 0.2s', whiteSpace:'nowrap',
        boxShadow: isActive ? `0 2px 8px ${cat.color}44` : 'none',
      }}
    >
      {isLoading ? <Loader2 size={12} className="animate-spin" /> : <span>{cat.emoji}</span>}
      {cat.label}
      {status === 'retrying' && (
        <span style={{ background: isActive ? 'rgba(255,255,255,0.3)' : '#fef08a',
          color: isActive ? 'white' : '#854d0e',
          padding:'1px 7px', borderRadius:99, fontSize:'0.7rem', fontWeight:700 }}>
          retry
        </span>
      )}
      {status === 'done' && (
        <span style={{ background: isActive ? 'rgba(255,255,255,0.3)' : `${cat.color}22`,
          color: isActive ? 'white' : cat.color,
          padding:'1px 7px', borderRadius:99, fontSize:'0.7rem', fontWeight:700 }}>
          {count}
        </span>
      )}
    </button>
  )
}

// �?��?��?� Main Finder page �?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?�
const WEBSITE_FILTERS = [
  { value: 'all', label: 'All' },
    { value: 'no_website', label: '⚡ No Website' },
    { value: 'inactive', label: '🔴 Inactive' },
    { value: 'active', label: '🟢 Active' },
]
const SORT_OPTIONS = [
  { value: 'leadScore', label: 'Lead Score' },
  { value: 'name', label: 'Name A–Z' },
  { value: 'category', label: 'Category' },
]

export default function Finder() {
  const businesses       = useStore((s) => s.businesses)
  const setBusinesses    = useStore((s) => s.setBusinesses)
  const appendBusinesses = useStore((s) => s.appendBusinesses)
  const updateBusiness   = useStore((s) => s.updateBusiness)
  const searchCity       = useStore((s) => s.searchCity)
  const setSearchCity    = useStore((s) => s.setSearchCity)
  const searchCategory   = useStore((s) => s.searchCategory)
  const setSearchCategory = useStore((s) => s.setSearchCategory)
  const isLoading        = useStore((s) => s.isLoading)
  const setIsLoading     = useStore((s) => s.setIsLoading)
  const searchError      = useStore((s) => s.searchError)
  const setSearchError   = useStore((s) => s.setSearchError)
  const websiteFilter    = useStore((s) => s.websiteFilter)
  const setWebsiteFilter = useStore((s) => s.setWebsiteFilter)
  const sortBy           = useStore((s) => s.sortBy)
  const setSortBy        = useStore((s) => s.setSortBy)
  const addLead          = useStore((s) => s.addLead)
  const leads            = useStore((s) => s.leads)

  const [searchedCity, setSearchedCity]     = useState('')
  const [citySuggestions, setCitySuggestions] = useState([])
  const [categoryFilter, setCategoryFilter] = useState('all')  // tab filter on results
  const [catStatus, setCatStatus]           = useState({})     // { salon: 'loading'|'done'|'error', ... }
  const [checkingWebsites, setCheckingWebsites] = useState(false)
  const cancelRef = useRef(false)
  const [candidates, setCandidates]         = useState(null)   // places awaiting user confirmation
  const [searchMeta, setSearchMeta]         = useState(null)   // { place, perCategory }
  const [selectedBizForDetails, setSelectedBizForDetails] = useState(null)
  const [listSearchQuery, setListSearchQuery]           = useState('')
  const [instantResults, setInstantResults]             = useState([])
  const [instantLoading, setInstantLoading]             = useState(false)
  const [hideDoubtful, setHideDoubtful]                  = useState(false)
  const [showReviewSection, setShowReviewSection]        = useState(false)
  const [selectedIds, setSelectedIds]                    = useState(new Set())
  const instantAbortRef = useRef(null)
  const searchIdRef = useRef(0)                                // newest search wins; older responses are ignored
  const abortRef = useRef(null)
  const resolvedPlaceRef = useRef(null)

  useEffect(() => {
    const query = searchCity.trim()
    if (query.length < 3 || resolvedPlaceRef.current?.query === query.toLowerCase()) { setCitySuggestions([]); return }
    const controller = new AbortController()
    const timer = setTimeout(async () => {
      try { setCitySuggestions(await resolveCity(query, controller.signal)) }
      catch (err) { if (err.name !== 'AbortError') setCitySuggestions([]) }
    }, 450)
    return () => { clearTimeout(timer); controller.abort() }
  }, [searchCity])

  // �?��?� Search flow �?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?�
  // 1) resolve the typed city into real places (ask the user if ambiguous)
  // 2) search each category on the server inside the confirmed place
  // 3) check websites in the background (separate server endpoint)
  const beginSearch = () => {
    abortRef.current?.abort()
    const ctl = new AbortController()
    abortRef.current = ctl
    return { id: ++searchIdRef.current, signal: ctl.signal }
  }

  const resetResults = () => {
    cancelRef.current = false
    setIsLoading(true)
    setSearchError(null)
    setBusinesses([])
    setCatStatus({})
    setCategoryFilter('all')
    setCandidates(null)
    setSearchMeta(null)
    setCheckingWebsites(false)
  }

  const handleSearch = async () => {
    const city = searchCity.trim()
    if (city.length < 2) return toast.error('Please enter a city name')
    if (!CATEGORIES.some((c) => c.id === searchCategory)) return toast.error('Select one business category first')
    const { id, signal } = beginSearch()
    resetResults()
    try {
      if (resolvedPlaceRef.current?.query === city.toLowerCase()) {
        await runSearch(resolvedPlaceRef.current.place, id, signal)
        return
      }
      const places = await resolveCity(city, signal)
      if (id !== searchIdRef.current) return
      if (places.length > 1) {          // ambiguous: let the user confirm
        setCandidates(places)
        setIsLoading(false)
        return
      }
      resolvedPlaceRef.current = { query: city.toLowerCase(), place: places[0] }
      await runSearch(places[0], id, signal)
    } catch (err) {
      if (err.name === 'AbortError' || id !== searchIdRef.current) return
      setSearchError(err.message)
      setIsLoading(false)
      toast.error(err.message)
    }
  }

  const handlePickPlace = async (place) => {
    resolvedPlaceRef.current = { query: searchCity.trim().toLowerCase(), place }
    const { id, signal } = beginSearch()
    resetResults()
    await runSearch(place, id, signal)
  }

  const runSearch = async (place, id, signal) => {
    const isStale = () => id !== searchIdRef.current
    const categoriesToSearch = CATEGORIES.filter((c) => c.id === searchCategory)

    const initStatus = {}
    categoriesToSearch.forEach((c) => { initStatus[c.id] = 'loading' })
    setCatStatus(initStatus)
    setSearchMeta({ place, perCategory: {} })

    const metas = {}
    let firstError = null

    await Promise.allSettled(categoriesToSearch.map(async (cat) => {
      try {
        const { businesses: found, meta } = await fetchCategoryBusinesses(place, cat.id, signal)
        if (isStale()) return
        const scored = found.map((b) => ({ ...b, city: searchCity, leadScore: computeLeadScore(b) }))
        appendBusinesses(scored)               // de-duplicated by id in the store
        metas[cat.id] = meta
        setSearchMeta({ place, perCategory: { ...metas } })
        setCatStatus((prev) => ({ ...prev, [cat.id]: 'done' }))
        toast(`${cat.emoji} ${cat.label}: ${scored.length} found`, { duration: 1800 })
      } catch (err) {
        if (err.name === 'AbortError' || isStale()) return
        setCatStatus((prev) => ({ ...prev, [cat.id]: 'error' }))
        firstError = firstError || err
      }
    }))

    if (isStale()) return

    if (isStale()) return
    setIsLoading(false)
    setSearchedCity(place.label || searchCity)
    const total = useStore.getState().businesses.length
    if (total === 0) {
      setSearchError(firstError
        ? firstError.message
        : `No businesses found in "${place.label || searchCity}" for this category. The data source may have limited coverage here. Try a larger area or another category.`)
    } else {
      if (firstError) toast.error(`Some categories failed: ${firstError.message}`, { duration: 5000 })
      toast.success(`✅ ${total} businesses found`, { duration: 2500 })
      startWebsiteChecking(id, signal)
    }
  }

  // �?��?� Website status checker (background, via the server) �?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?�
  const startWebsiteChecking = async (id, signal) => {
    setCheckingWebsites(true)
    const pending = useStore.getState().businesses.filter((b) => b.website && b.websiteStatus === 'checking')
    try {
      for (let i = 0; i < pending.length; i += 10) {
        if (id !== searchIdRef.current) return
        const batch = pending.slice(i, i + 10)
        let results = null
        try {
          results = await checkWebsites(batch.map((b) => b.website), signal)
        } catch (err) {
          if (err.name === 'AbortError') return
        }
        if (id !== searchIdRef.current) return
        batch.forEach((biz) => {
          const r = results?.[biz.website]
          const status = r?.status || 'unknown'      // never guess "inactive" when the check itself failed
          updateBusiness(biz.id, {
            websiteStatus: status,
            websiteNote: r?.note || '',
            leadScore: computeLeadScore({ ...biz, websiteStatus: status }),
          })
        })
      }
    } finally {
      if (id === searchIdRef.current) setCheckingWebsites(false)
    }
  }

  const handleAddLead = (biz) => {
    const added = addLead({ ...biz, city: searchCity || biz.city })
    if (added) toast.success(`${biz.name} added to Lead Tracker!`)
    else toast.error('Already in Lead Tracker')
  }

  const handleToggleSelect = (id) => {
    setSelectedIds((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })
  }

  const handleSelectAll = () => {
    setSelectedIds(selectedIds.size === filteredSorted.length && filteredSorted.length > 0
      ? new Set()
      : new Set(filteredSorted.map((b) => b.id)))
  }

  const handleAddSelectedLeads = () => {
    let added = 0
    filteredSorted.filter((b) => selectedIds.has(b.id)).forEach((b) => {
      if (addLead({ ...b, city: searchCity || b.city })) added++
    })
    toast.success(`${added} lead${added !== 1 ? 's' : ''} added to Lead Tracker!`)
    setSelectedIds(new Set())
  }

  // Helper to find location coordinates for the live search
  const getSearchCoords = async (signal) => {
    if (searchMeta?.place?.lat != null) return searchMeta.place
    const b = businesses.find((x) => x.lat != null && x.lon != null)
    if (b) return { lat: b.lat, lon: b.lon }
    if (searchCity?.trim()) {
      try {
        const p = await resolveCity(searchCity.trim(), signal)
        if (p?.[0]) return p[0]
      } catch { /* ignore */ }
    }
    return null
  }

  // �?��?� Hybrid search: filter listed + live search fallback �?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?�
  const triggerLiveSearch = async (query) => {
    if (!query?.trim() || query.trim().length < 2) return
    instantAbortRef.current?.abort()
    const ctl = new AbortController()
    instantAbortRef.current = ctl
    setInstantLoading(true)
    try {
      const cityCoords = await getSearchCoords(ctl.signal)
      if (!cityCoords) {
        setInstantLoading(false)
        return
      }
      const results = await instantSearch(query.trim(), cityCoords.lat, cityCoords.lon, ctl.signal)
      if (!ctl.signal.aborted) {
        const knownNames = new Set(businesses.map((b) => (b.name || '').toLowerCase().trim()))
        const fresh = results.filter((r) => !knownNames.has((r.name || '').toLowerCase().trim()))
        setInstantResults(fresh)
        if (fresh.length > 0) {
          toast.success(`Found ${fresh.length} additional places by live search!`, { duration: 2500 })
        }
      }
    } catch (err) {
      if (err.name !== 'AbortError') setInstantResults([])
    } finally {
      if (!ctl.signal.aborted) setInstantLoading(false)
    }
  }

  const handleListSearch = (query) => {
    setListSearchQuery(query)
    setInstantResults([])
    if (!query.trim()) return

    instantAbortRef.current?.abort()
    if (query.trim().length < 2) return

    const ctl = new AbortController()
    instantAbortRef.current = ctl
    setTimeout(async () => {
      if (ctl.signal.aborted) return
      setInstantLoading(true)
      try {
        const cityCoords = await getSearchCoords(ctl.signal)
        if (!cityCoords) {
          setInstantLoading(false)
          return
        }
        const results = await instantSearch(query.trim(), cityCoords.lat, cityCoords.lon, ctl.signal)
        if (!ctl.signal.aborted) {
          const knownNames = new Set(businesses.map((b) => (b.name || '').toLowerCase().trim()))
          const fresh = results.filter((r) => !knownNames.has((r.name || '').toLowerCase().trim()))
          setInstantResults(fresh)
        }
      } catch (err) {
        if (err.name !== 'AbortError') setInstantResults([])
      } finally {
        if (!ctl.signal.aborted) setInstantLoading(false)
      }
    }, 450)
  }

  const handleImportAllInstant = () => {
    if (instantResults.length === 0) return
    appendBusinesses(instantResults)
    toast.success(`Imported ${instantResults.length} businesses to your dashboard list!`)
    setInstantResults([])
  }

  // �?��?� Filter + sort pipeline with Category Validation �?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?�
  // Reapply validation dynamically whenever user selects or changes category.
  const evaluatedBusinesses = businesses.map((b) => {
    const targetCat = categoryFilter !== 'all' ? categoryFilter : b.category
    const validation = validateBusinessCategory(b, targetCat)
    return { ...b, categoryValidation: validation }
  })

  // Prevent rejected businesses from appearing under this category
  const nonRejected = evaluatedBusinesses.filter((b) => b.categoryValidation?.status !== 'REJECT')

  // Split into Accepted (default) and Review (Needs Verification)
  const acceptedList = nonRejected.filter((b) => b.categoryValidation?.status === 'ACCEPT')
  const reviewList   = nonRejected.filter((b) => b.categoryValidation?.status === 'REVIEW')

  function applyFilters(list) {
    let res = list

    // Category tab filter
    if (categoryFilter !== 'all') {
      res = res.filter((b) => b.category === categoryFilter)
    }

    // Website status filter
    if (websiteFilter !== 'all') {
      res = res.filter((b) => b.websiteStatus === websiteFilter)
    }

    // Hide rows whose location looks doubtful (shown with a "Verify location" badge)
    if (hideDoubtful) {
      res = res.filter((b) => b.locationCheck?.level !== 'check')
    }

    // Hybrid list-search text filter
    if (listSearchQuery.trim()) {
      const q = listSearchQuery.trim().toLowerCase()
      res = res.filter((b) =>
        (b.name || '').toLowerCase().includes(q) ||
        (b.address || '').toLowerCase().includes(q) ||
        (b.locality || '').toLowerCase().includes(q) ||
        (b.city || '').toLowerCase().includes(q) ||
        (b.subcategories || []).some((s) => s.toLowerCase().includes(q))
      )
    }

    // Sort
    return [...res].sort((a, b) => {
      if (sortBy === 'leadScore') return b.leadScore - a.leadScore
      if (sortBy === 'name')      return (a.name || '').localeCompare(b.name || '')
      if (sortBy === 'category')  return (a.category || '').localeCompare(b.category || '')
      return 0
    })
  }

  const filteredSorted = applyFilters(acceptedList)
  const reviewSorted   = applyFilters(reviewList)

  const handleExport = (itemsToExport = filteredSorted, customFilename = null) => {
    if (!itemsToExport || itemsToExport.length === 0) return toast.error('No data to export')
    const filename = customFilename || `businesses_${searchCategory || 'all'}_${searchCity.replace(/\s/g,'_')}.xlsx`
    exportToExcel(itemsToExport, filename)
    toast.success('Excel file downloaded!')
  }

  // Counts per category for pills (based on accepted businesses)
  const catCounts = {}
  CATEGORIES.forEach((c) => {
    catCounts[c.id] = acceptedList.filter((b) => b.category === c.id).length
  })

  const statusCounts = {
    no_website: acceptedList.filter((b) => b.websiteStatus === 'no_website').length,
    inactive:   acceptedList.filter((b) => b.websiteStatus === 'inactive').length,
    active:     acceptedList.filter((b) => b.websiteStatus === 'active').length,
  }

  const metaList = Object.values(searchMeta?.perCategory || {})
  const doubtfulCount = businesses.filter((b) => b.locationCheck?.level === 'check').length
  const metaWarnings = [...new Set(metaList.flatMap((m) => m.warnings || []))]

  const leadIds = new Set(leads.map((l) => l.id))
  const hasSearched = businesses.length > 0 || !!searchError
  const isSearching = isLoading

  return (
    <div className="finder-page">

      {/* �?��?� Search panel �?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?� */}
      <div className="card finder-search-card" style={{ padding: '1.5rem', marginBottom: '1.25rem' }}>
        <h2 className="finder-search-title" style={{ margin:'0 0 1rem', fontSize:'1rem', fontWeight:700, color:'#1e293b',
          display:'flex', alignItems:'center', gap:'0.5rem' }}>
          <Search size={17} color="#6366f1" /> Find Local Businesses Worldwide
        </h2>

        <div className="finder-search-controls" style={{ display:'grid', gridTemplateColumns:'1fr auto', gap:'0.875rem', alignItems:'end' }}>
          {/* City */}
          <div>
            <label style={{ fontSize:'0.78rem', fontWeight:600, color:'#374151', display:'block', marginBottom:'0.35rem' }}>
              City / Location *
            </label>
            <div style={{ position:'relative' }}>
              <MapPin size={14} style={{ position:'absolute', left:10, top:'50%', transform:'translateY(-50%)', color:'#94a3b8' }} />
              <input
                className="input-field finder-location-input"
                style={{ paddingLeft:'2rem' }}
                placeholder="Type a city or area name"
                value={searchCity}
                onChange={(e) => { resolvedPlaceRef.current = null; setCandidates(null); setSearchCity(e.target.value) }}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              />
              {citySuggestions.length > 0 && <div role="listbox" aria-label="City suggestions" style={{ position:'absolute', zIndex:20, top:'calc(100% + 4px)', left:0, right:0, background:'#fff', border:'1px solid #e2e8f0', borderRadius:10, boxShadow:'0 10px 24px #0f172a20', overflow:'hidden' }}>
                {citySuggestions.slice(0, 6).map((place) => <button key={`${place.label}-${place.lat}`} type="button" role="option" onClick={() => {
                  resolvedPlaceRef.current = { query: place.label.toLowerCase(), place }
                  setSearchCity(place.label); setCitySuggestions([]); setCandidates(null)
                }} style={{ display:'block', width:'100%', border:0, borderBottom:'1px solid #f1f5f9', background:'#fff', textAlign:'left', padding:'.7rem .85rem', cursor:'pointer', color:'#334155' }}><MapPin size={13} style={{ verticalAlign:'middle', marginRight:8 }}/>{place.label}</button>)}
              </div>}
              {searchCity && <button type="button" aria-label="Clear city" onClick={() => { resolvedPlaceRef.current = null; setSearchCity(''); setCandidates(null) }}
                style={{ position:'absolute', right:9, top:'50%', transform:'translateY(-50%)', border:0, background:'transparent', color:'#64748b', cursor:'pointer' }}><X size={15}/></button>}
            </div>
          </div>

          <div className="finder-category-group" style={{ marginTop:'1rem' }}>
          <label style={{ fontSize:'.78rem', fontWeight:700, color:'#374151', display:'block', marginBottom:'.5rem' }}>Choose one category</label>
          <div className="finder-category-options" style={{ display:'flex', flexWrap:'wrap', gap:'.5rem' }}>
            {CATEGORIES.map((cat) => <button key={cat.id} type="button" aria-pressed={searchCategory === cat.id}
              onClick={() => setSearchCategory(cat.id)} className="finder-category-option" style={{ border:`1px solid ${searchCategory === cat.id ? cat.color : '#e2e8f0'}`,
                background:searchCategory === cat.id ? cat.bg : '#fff', color:searchCategory === cat.id ? cat.color : '#475569',
                borderRadius:10, padding:'.55rem .8rem', fontWeight:700, cursor:'pointer' }}>
              {cat.emoji} {cat.label}
            </button>)}
          </div>
        </div>
        {/* Search button */}
          <button
            onClick={handleSearch}
            disabled={isSearching}
            className="btn-primary finder-submit"
            style={{ height:40, padding:'0 1.5rem', whiteSpace:'nowrap' }}
          >
            {isSearching
              ? <><Loader2 size={14} className="animate-spin" /> Searching…</>
              : <><Search size={14} /> Search Selected Category</>}
          </button>
        </div>

        {/* Tip */}
        {!hasSearched && (
          <p style={{ margin:'0.75rem 0 0', fontSize:'0.78rem', color:'#94a3b8' }}>
            💡 Search sends a request for the selected category only. Pick a city match when the name is ambiguous.
          </p>
        )}
      </div>

      {/* �?��?� Ambiguous city: ask the user to confirm �?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?� */}
      {candidates && (
        <div className="card" style={{ padding:'1.25rem', marginBottom:'1.25rem' }}>
          <h3 style={{ margin:'0 0 0.25rem', fontSize:'0.95rem', fontWeight:700, color:'#1e293b' }}>
            Which place did you mean?
          </h3>
          <p style={{ margin:'0 0 0.75rem', fontSize:'0.8rem', color:'#64748b' }}>
            Several matches were found for “{searchCity}”?. Pick one so results stay inside the right area.
          </p>
          <div style={{ display:'flex', flexDirection:'column', gap:'0.5rem' }}>
            {candidates.map((p) => (
              <button key={`${p.label}-${p.lat}-${p.lon}`} className="btn-secondary"
                onClick={() => handlePickPlace(p)}
                style={{ justifyContent:'flex-start', textAlign:'left', gap:8 }}>
                <MapPin size={13} /> {p.label}
                <span style={{ marginLeft:'auto', fontSize:'0.7rem', color:'#94a3b8' }}>
                  {p.entityType || 'Place'}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* �?��?� Coverage / geography notice �?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?� */}
      {metaList.length > 0 && businesses.length > 0 && (
        <div style={{ background:'#fffbeb', border:'1px solid #fde68a', borderRadius:10,
          padding:'0.75rem 1rem', marginBottom:'1rem', fontSize:'0.8rem', color:'#92400e' }}>
          <strong>{businesses.length}</strong> businesses retrieved from Google Maps for <strong>{searchMeta.place.label}</strong>.{' '}
          Results are limited to the city&apos;s map area (Google has no exact city boundary), so some may be just outside the city
          {doubtfulCount > 0 ? <>: <strong>{doubtfulCount}</strong> are marked &ldquo;Verify location&rdquo;.</> : '.'}
          {' '}Coverage has not been verified: Google Maps may not list every business.
          {metaWarnings.length > 0 && (
            <ul style={{ margin:'0.4rem 0 0', paddingLeft:'1.1rem' }}>
              {metaWarnings.map((w) => <li key={w}>{w}</li>)}
            </ul>
          )}
        </div>
      )}

      {/* �?��?� Error �?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?� */}
      {searchError && (
        <div style={{ background:'#fef2f2', border:'1px solid #fecaca', borderRadius:10,
          padding:'1rem 1.25rem', display:'flex', alignItems:'flex-start', gap:'0.75rem',
          marginBottom:'1.25rem', color:'#991b1b', fontSize:'0.85rem' }}>
          <AlertCircle size={18} style={{ flexShrink:0, marginTop:1 }} />
          <div>
            <strong>{businesses.length === 0 ? 'No results.' : 'Search problem.'}</strong><br />
            {searchError}
          </div>
        </div>
      )}

      {/* �?��?� Results area �?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?� */}
      {(businesses.length > 0 || isSearching) && (
        <>
          {/* Hybrid Instant Search Bar: filters listed businesses AND runs a live search */}
          <div style={{
            background: 'white', borderRadius: 12, border: '1.5px solid #e2e8f0',
            padding: '1rem', marginBottom: '1.25rem', boxShadow: '0 2px 6px rgba(0,0,0,0.03)'
          }}>
            <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
              <div style={{ position: 'relative', flex: 1 }}>
                <Search size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#6366f1' }} />
                <input
                  className="input-field"
                  style={{ paddingLeft: '2.4rem', height: 42, fontSize: '0.875rem' }}
                  placeholder="Search listed businesses (or type any business name to search live if unlisted)…"
                  value={listSearchQuery}
                  onChange={(e) => handleListSearch(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && triggerLiveSearch(listSearchQuery)}
                />
                {listSearchQuery && (
                  <button
                    onClick={() => handleListSearch('')}
                    style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8' }}
                  >
                    <X size={15} />
                  </button>
                )}
              </div>
              <button
                className="btn-primary"
                onClick={() => triggerLiveSearch(listSearchQuery)}
                disabled={instantLoading || !listSearchQuery.trim()}
                style={{ height: 42, padding: '0 1.25rem', display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.85rem', whiteSpace: 'nowrap' }}
              >
                {instantLoading ? <Loader2 size={14} className="animate-spin" /> : <Globe size={14} />}
                Live Search
              </button>
            </div>

            {listSearchQuery && (
              <div style={{ marginTop: '0.6rem', fontSize: '0.76rem', color: '#64748b', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 6 }}>
                <span>
                  Filtering listed businesses: <strong>{filteredSorted.length} matching</strong>
                </span>
                {instantLoading && (
                  <span style={{ color: '#6366f1', display: 'flex', alignItems: 'center', gap: 5 }}>
                    <Loader2 size={12} className="animate-spin" /> Searching live for &ldquo;{listSearchQuery}&rdquo;…
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Category pills (streaming status) */}
          <div style={{ display:'flex', gap:'0.5rem', flexWrap:'wrap', marginBottom:'1rem', alignItems:'center' }}>
            <span style={{ fontSize:'0.78rem', color:'#64748b', fontWeight:600 }}>Filter:</span>
            <button
              onClick={() => setCategoryFilter('all')}
              style={{ padding:'0.4rem 0.85rem', borderRadius:99, border:'none', cursor:'pointer',
                background: categoryFilter === 'all' ? '#6366f1' : '#f1f5f9',
                color: categoryFilter === 'all' ? 'white' : '#374151',
                fontSize:'0.8rem', fontWeight:600, transition:'all 0.2s' }}>
              <LayoutGrid size={12} style={{ display:'inline', verticalAlign:'middle', marginRight:4 }} />
              All ({businesses.length})
            </button>
            {CATEGORIES.map((cat) => (
              catStatus[cat.id] && (
                <CategoryPill
                  key={cat.id}
                  cat={cat}
                  status={catStatus[cat.id]}
                  count={catCounts[cat.id] || 0}
                  isActive={categoryFilter === cat.id}
                  onClick={() => setCategoryFilter(categoryFilter === cat.id ? 'all' : cat.id)}
                />
              )
            ))}
          </div>

          {/* Summary bar */}
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between',
            flexWrap:'wrap', gap:'0.75rem', marginBottom:'1rem' }}>
            <div style={{ display:'flex', alignItems:'center', gap:'0.75rem', flexWrap:'wrap' }}>
              <span style={{ fontSize:'0.875rem', color:'#64748b' }}>
                Showing <strong style={{ color:'#1e293b' }}>{filteredSorted.length}</strong> of{' '}
                <strong style={{ color:'#6366f1' }}>{businesses.length}</strong> businesses
                {searchedCity && <> in <strong style={{ color:'#6366f1' }}>{searchedCity}</strong></>}
              </span>

              {checkingWebsites && (
                <span style={{ fontSize:'0.78rem', color:'#6366f1', display:'flex', alignItems:'center', gap:4 }}>
                  <RefreshCw size={12} className="animate-spin" /> Verifying websites…
                </span>
              )}

              {/* Status summary pills */}
              <div style={{ display:'flex', gap:'0.4rem' }}>
                <span className="badge badge-nowebsite">No Site: {statusCounts.no_website}</span>
                <span className="badge badge-inactive">Inactive: {statusCounts.inactive}</span>
                <span className="badge badge-active">Active: {statusCounts.active}</span>
              </div>
            </div>

            <div style={{ display:'flex', gap:'0.6rem', flexWrap:'wrap', alignItems:'center' }}>
              {filteredSorted.length > 0 && (
                <label style={{ display:'flex', alignItems:'center', gap:5, fontSize:'0.8rem', color:'#374151', cursor:'pointer', fontWeight:600 }}>
                  <input type="checkbox"
                    checked={selectedIds.size === filteredSorted.length && filteredSorted.length > 0}
                    onChange={handleSelectAll}
                    style={{ accentColor:'#6366f1' }}
                  />
                  Select All
                </label>
              )}
              {/* Hide doubtful locations */}
              <label style={{ display:'flex', alignItems:'center', gap:6, fontSize:'0.8rem', color:'#374151', cursor:'pointer' }}>
                <input type="checkbox" checked={hideDoubtful} onChange={(e) => setHideDoubtful(e.target.checked)} />
                Hide doubtful locations ({businesses.filter((b) => b.locationCheck?.level === 'check').length})
              </label>

              {/* Website status filter */}
              <select className="select-field" style={{ width:'auto', fontSize:'0.8rem' }}
                value={websiteFilter} onChange={(e) => setWebsiteFilter(e.target.value)}>
                {WEBSITE_FILTERS.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
              </select>

              {/* Sort */}
              <select className="select-field" style={{ width:'auto', fontSize:'0.8rem' }}
                value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
                {SORT_OPTIONS.map((o) => <option key={o.value} value={o.value}>Sort: {o.label}</option>)}
              </select>

              {/* Export */}
              <button className="btn-success" onClick={() => handleExport(filteredSorted)}
                style={{ fontSize:'0.8rem', padding:'0.4rem 0.875rem' }}>
                <Download size={13} /> Export Excel
              </button>
            </div>
          </div>

          {/* �?��?� Optional "Needs Verification" section for uncertain results �?��?� */}
          {reviewSorted.length > 0 && (
            <div style={{
              background: '#fffdf5', border: '1.5px solid #fde68a', borderRadius: 12,
              padding: '1rem 1.25rem', marginBottom: '1.25rem', boxShadow: '0 1px 3px rgba(0,0,0,0.03)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ background: '#fef3c7', padding: '6px 8px', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <AlertCircle size={18} color="#b45309" />
                  </div>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700, color: '#92400e' }}>
                        Needs Category Verification ({reviewSorted.length})
                      </h3>
                      <span style={{ fontSize: '0.7rem', background: '#fef3c7', color: '#92400e', padding: '1px 8px', borderRadius: 99, fontWeight: 700 }}>
                        Uncertain Matches
                      </span>
                    </div>
                    <p style={{ margin: '0.2rem 0 0', fontSize: '0.78rem', color: '#78350f' }}>
                      Google Places returned these listings, but evidence is inconclusive or requires confirmation before outreach. Kept here so legitimate businesses are not silently lost.
                    </p>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                  <button
                    className="btn-secondary"
                    onClick={() => handleExport(reviewSorted, `needs_verification_${searchCategory || 'all'}_${searchCity.replace(/\s/g,'_')}.xlsx`)}
                    style={{ fontSize: '0.78rem', padding: '0.4rem 0.8rem', color: '#92400e', borderColor: '#fde68a' }}
                  >
                    <Download size={12} /> Export Unverified
                  </button>
                  <button
                    className="btn-primary"
                    onClick={() => setShowReviewSection(!showReviewSection)}
                    style={{ fontSize: '0.78rem', padding: '0.4rem 0.9rem', background: '#d97706', borderColor: '#b45309' }}
                  >
                    {showReviewSection ? 'Hide Verification List' : `Inspect Unverified (${reviewSorted.length})`}
                  </button>
                </div>
              </div>

              {showReviewSection && (
                <div style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px dashed #fde68a' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '0.875rem' }}>
                    {reviewSorted.map((biz) => (
                      <BusinessCard
                        key={biz.id}
                        biz={biz}
                        onAddLead={handleAddLead}
                        alreadyAdded={leadIds.has(biz.id)}
                        onOpenDetails={() => setSelectedBizForDetails(biz)}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Business grid */}
          {selectedIds.size > 0 && (
            <div style={{ display:'flex', alignItems:'center', gap:'0.75rem', background:'#ede9fe',
              border:'1px solid #c7d2fe', borderRadius:10, padding:'0.6rem 1rem', marginBottom:'0.75rem', flexWrap:'wrap' }}>
              <span style={{ fontSize:'0.85rem', fontWeight:700, color:'#4338ca' }}>{selectedIds.size} selected</span>
              <button className="btn-primary" onClick={handleAddSelectedLeads}
                style={{ fontSize:'0.82rem', padding:'0.35rem 0.9rem' }}>
                <Plus size={13} /> Add {selectedIds.size} to Lead Tracker
              </button>
              <button className="btn-secondary" onClick={() => setSelectedIds(new Set())}
                style={{ fontSize:'0.82rem', padding:'0.35rem 0.75rem' }}>
                <X size={13} /> Deselect All
              </button>
            </div>
          )}

          {filteredSorted.length > 0 ? (
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(280px, 1fr))', gap:'0.875rem' }}>
              {filteredSorted.map((biz) => (
                <BusinessCard
                  key={biz.id}
                  biz={biz}
                  onAddLead={handleAddLead}
                  alreadyAdded={leadIds.has(biz.id)}
                  onOpenDetails={() => setSelectedBizForDetails(biz)}
                  selected={selectedIds.has(biz.id)}
                  onToggleSelect={() => handleToggleSelect(biz.id)}
                />
              ))}
            </div>
          ) : (
            !isSearching && (
              <div style={{ textAlign:'center', padding:'2.5rem', color:'#64748b', background:'white',
                borderRadius:12, border:'1px solid #f1f5f9' }}>
                {listSearchQuery.trim() ? (
                  <>
                    <p style={{ margin: '0 0 0.5rem', fontWeight: 600, color: '#334155' }}>
                      No listed businesses match &ldquo;{listSearchQuery}&rdquo;
                    </p>
                    <p style={{ margin: 0, fontSize: '0.82rem', color: '#94a3b8' }}>
                      {instantLoading ? 'Searching live now…' : instantResults.length > 0 ? 'See live results below:' : 'No matching results found in the initial list or on live web search.'}
                    </p>
                  </>
                ) : (
                  'No businesses match the current filter. Try changing the website status filter.'
                )}
              </div>
            )
          )}

          {/* �?��?� Unlisted Live Results �?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?� */}
          {instantResults.length > 0 && (
            <div style={{
              marginTop: '1.75rem', padding: '1.25rem', background: '#f8fafc',
              border: '1.5px dashed #818cf8', borderRadius: 14,
            }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'1rem', flexWrap:'wrap', gap:'0.75rem' }}>
                <div>
                  <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                    <span style={{ fontSize:'1.25rem' }}>🌝?</span>
                    <h3 style={{ margin:0, fontSize:'0.98rem', fontWeight:700, color:'#1e293b' }}>
                      Live Results for &ldquo;{listSearchQuery}&rdquo;
                    </h3>
                    <span style={{ fontSize:'0.75rem', background:'#e0e7ff', color:'#4338ca', padding:'2px 8px', borderRadius:99, fontWeight:700 }}>
                      {instantResults.length} unlisted place{instantResults.length === 1 ? '' : 's'} found
                    </span>
                  </div>
                  <p style={{ margin:'0.25rem 0 0', fontSize:'0.78rem', color:'#64748b' }}>
                    These places were not in the initial search results, but were found by a live search.
                  </p>
                </div>
                <button
                  className="btn-primary"
                  onClick={handleImportAllInstant}
                  style={{ fontSize:'0.82rem', padding:'0.45rem 1rem', display:'flex', alignItems:'center', gap:6 }}
                >
                  <Plus size={14} /> Add All to Dashboard
                </button>
              </div>

              <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(280px, 1fr))', gap:'0.875rem' }}>
                {instantResults.map((biz) => (
                  <BusinessCard
                    key={biz.id}
                    biz={biz}
                    onAddLead={handleAddLead}
                    alreadyAdded={leadIds.has(biz.id)}
                    onOpenDetails={() => setSelectedBizForDetails(biz)}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Loading skeleton while categories stream in */}
          {isSearching && businesses.length === 0 && (
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(280px, 1fr))', gap:'0.875rem' }}>
              {Array(8).fill(0).map((_, i) => (
                <div key={i} className="card" style={{ padding:'1.25rem', height:220 }}>
                  <div className="skeleton" style={{ height:16, width:'60%', marginBottom:8 }} />
                  <div className="skeleton" style={{ height:12, width:'80%', marginBottom:16 }} />
                  <div className="skeleton" style={{ height:12, width:'40%', marginBottom:8 }} />
                  <div className="skeleton" style={{ height:12, width:'55%', marginBottom:16 }} />
                  <div className="skeleton" style={{ height:36, width:'100%' }} />
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* �?��?� Empty state �?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?� */}
      {!isSearching && !hasSearched && (
        <div className="card" style={{ padding:'3.5rem 2rem', textAlign:'center', color:'#94a3b8' }}>
          <Search size={48} style={{ display:'block', margin:'0 auto 1rem', opacity:0.25 }} />
          <h3 style={{ margin:'0 0 0.5rem', color:'#64748b', fontSize:'1.05rem' }}>
            Find Local Businesses Anywhere
          </h3>
          <p style={{ margin:'0 0 1.5rem', fontSize:'0.85rem', maxWidth:480, marginLeft:'auto', marginRight:'auto' }}>
            Enter any city name above to search across all business categories (Salons, Spas, Gyms, Turfs, and Travel &amp; Tours) automatically.
          </p>
          <div style={{ display:'flex', gap:'0.5rem', justifyContent:'center', flexWrap:'wrap' }}>
            {CATEGORIES.map((c) => (
              <button key={c.id}
                onClick={() => { setSearchCategory(c.id); document.querySelector('.input-field')?.focus() }}
                style={{ padding:'0.4rem 0.85rem', borderRadius:99, border:`1px solid ${c.color}44`,
                  background: c.bg, color: c.color, fontSize:'0.8rem', fontWeight:600, cursor:'pointer' }}>
                {c.emoji} {c.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* �?��?� Full Business Details Modal �?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?��?� */}
      {selectedBizForDetails && (
        <BusinessDetailsModal
          biz={selectedBizForDetails}
          onClose={() => setSelectedBizForDetails(null)}
          onAddLead={handleAddLead}
          isAdded={leadIds.has(selectedBizForDetails.id)}
        />
      )}
    </div>
  )
}