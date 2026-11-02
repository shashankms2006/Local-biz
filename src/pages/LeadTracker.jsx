import { useState } from 'react'
import { toast } from 'react-hot-toast'
import useStore from '../store/useStore'
import { CATEGORIES, CONTACT_STATUSES, getContactStatus } from '../utils/categories'
import { exportLeadsToExcel, getValidMapUrl } from '../utils/api'
import { FileCode2, Users,
  Trash2,
  Download,
  Search,
  Edit3,
  Check,
  X,
  ChevronUp,
  ChevronDown,
  Globe,
  ExternalLink,
  Phone,
} from 'lucide-react'
import { chooseTemplate } from '../websiteTemplates'
import { useNavigate } from 'react-router-dom'

function ContactStatusBadge({ value }) {
  const status = getContactStatus(value)
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: '0.2rem 0.65rem',
        borderRadius: 99,
        fontSize: '0.72rem',
        fontWeight: 600,
        color: status.color,
        background: status.bg,
        whiteSpace: 'nowrap',
      }}
    >
      {status.label}
    </span>
  )
}

function InlineEdit({ value, onSave, type = 'text', options }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value)

  const handleSave = () => {
    onSave(draft)
    setEditing(false)
  }

  if (!editing) {
    return (
      <div
        style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', minWidth: 0 }}
        onClick={() => setEditing(true)}
      >
        {type === 'select' ? (
          <ContactStatusBadge value={value} />
        ) : (
          <span
            style={{
              fontSize: '0.82rem',
              color: value ? '#374151' : '#94a3b8',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              maxWidth: 200,
            }}
          >
            {value || 'Click to add note…'}
          </span>
        )}
        <Edit3 size={11} color="#94a3b8" style={{ flexShrink: 0 }} />
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
      {type === 'select' ? (
        <select
          className="select-field"
          style={{ width: 160, fontSize: '0.8rem', padding: '0.25rem 0.5rem' }}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          autoFocus
        >
          {options.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      ) : (
        <input
          className="input-field"
          style={{ padding: '0.25rem 0.5rem', fontSize: '0.8rem', minWidth: 160 }}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleSave()
            if (e.key === 'Escape') setEditing(false)
          }}
          autoFocus
        />
      )}
      <button onClick={handleSave} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#10b981', padding: 2 }}>
        <Check size={14} />
      </button>
      <button onClick={() => setEditing(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', padding: 2 }}>
        <X size={14} />
      </button>
    </div>
  )
}

export default function LeadTracker() {
  const leads = useStore((s) => s.leads)
  const removeLead = useStore((s) => s.removeLead)
  const updateLead = useStore((s) => s.updateLead)
  const clearAllLeads = useStore((s) => s.clearAllLeads)
  const navigate = useNavigate()

  const handleBuildPreview = (lead) => {
    const key = lead.id
    const saved = JSON.parse(localStorage.getItem('generated_business_sites') || '{}')
    const seed = saved[key]?.seed || `${key}:${Date.now()}`
    const recent = JSON.parse(localStorage.getItem('recent_business_template_ids') || '[]')
    const template = saved[key]?.templateId
      ? saved[key]
      : (() => { const t = chooseTemplate(lead.category, key, seed, recent.slice(0, 3)); localStorage.setItem('recent_business_template_ids', JSON.stringify([t.id, ...recent].slice(0, 12))); return t })();
    saved[key] = { placeId: lead.id, category: lead.category, seed, templateId: template.templateId || template.id, business: lead, createdAt: saved[key]?.createdAt || new Date().toISOString() }
    localStorage.setItem('generated_business_sites', JSON.stringify(saved))
    window.open(`${window.location.origin}/preview/${encodeURIComponent(key)}`, '_blank', 'noopener,noreferrer')
  }

  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [sortField, setSortField] = useState('addedAt')
  const [sortDir, setSortDir] = useState('desc')
  const [confirmClear, setConfirmClear] = useState(false)
  const [selectedIds, setSelectedIds] = useState(new Set())

  const handleToggleSelect = (id) => {
    setSelectedIds((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })
  }

  const handleSelectAll = () => {
    setSelectedIds(selectedIds.size === filtered.length && filtered.length > 0
      ? new Set()
      : new Set(filtered.map((l) => l.id)))
  }

  const handleBuildAllSelected = () => {
    const targets = filtered.filter((l) => selectedIds.has(l.id))
    const saved = JSON.parse(localStorage.getItem('generated_business_sites') || '{}')
    const recent = JSON.parse(localStorage.getItem('recent_business_template_ids') || '[]')
    const newRecent = [...recent]
    targets.forEach((lead) => {
      const key = lead.id
      const seed = saved[key]?.seed || `${key}:${Date.now()}`
      const template = saved[key]?.templateId
        ? saved[key]
        : (() => { const t = chooseTemplate(lead.category, key, seed, newRecent.slice(0, 3)); newRecent.unshift(t.id); return t })()
      saved[key] = { placeId: lead.id, category: lead.category, seed, templateId: template.templateId || template.id, business: lead, createdAt: saved[key]?.createdAt || new Date().toISOString() }
    })
    localStorage.setItem('generated_business_sites', JSON.stringify(saved))
    localStorage.setItem('recent_business_template_ids', JSON.stringify(newRecent.slice(0, 12)))
    targets.forEach((lead) => {
      window.open(`${window.location.origin}/preview/${encodeURIComponent(lead.id)}`, '_blank', 'noopener,noreferrer')
    })
    setSelectedIds(new Set())
  }

  const handleSort = (field) => {
    if (sortField === field) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    else { setSortField(field); setSortDir('asc') }
  }

  const SortIcon = ({ field }) => {
    if (sortField !== field) return null
    return sortDir === 'asc' ? <ChevronUp size={12} /> : <ChevronDown size={12} />
  }

  const filtered = leads
    .filter((l) => {
      if (search && !l.name.toLowerCase().includes(search.toLowerCase())) return false
      if (categoryFilter !== 'all' && l.category !== categoryFilter) return false
      if (statusFilter !== 'all' && l.contactStatus !== statusFilter) return false
      return true
    })
    .sort((a, b) => {
      let va = a[sortField], vb = b[sortField]
      if (sortField === 'leadScore') { va = a.leadScore; vb = b.leadScore }
      if (typeof va === 'string') va = va.toLowerCase()
      if (typeof vb === 'string') vb = vb.toLowerCase()
      if (va < vb) return sortDir === 'asc' ? -1 : 1
      if (va > vb) return sortDir === 'asc' ? 1 : -1
      return 0
    })

  const handleExport = () => {
    if (filtered.length === 0) return toast.error('No leads to export')
    exportLeadsToExcel(filtered, 'leads.xlsx')
    toast.success('Leads exported!')
  }

  const handleClear = () => {
    clearAllLeads()
    setConfirmClear(false)
    toast.success('All leads cleared')
  }

  const websiteStatusBadge = (status) => {
    const map = {
      active: { label: 'Active', cls: 'badge-active' },
      inactive: { label: 'Inactive', cls: 'badge-inactive' },
      no_website: { label: 'No Site', cls: 'badge-nowebsite' },
      checking: { label: 'Checking', cls: 'badge-nowebsite' },
    }
    const s = map[status] || map.no_website
    return <span className={`badge ${s.cls}`}>{s.label}</span>
  }

  return (
    <div style={{ maxWidth: 1400, margin: '0 auto' }}>
      {/* Header bar */}
      <div className="card" style={{ padding: '1.25rem 1.5rem', marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', flex: 1 }}>
            {/* Search */}
            <div style={{ position: 'relative', minWidth: 200 }}>
              <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
              <input
                className="input-field"
                style={{ paddingLeft: '2rem', width: '100%' }}
                placeholder="Search leads…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            {/* Category filter */}
            <select className="select-field" style={{ width: 'auto' }} value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}>
              <option value="all">All Categories</option>
              {CATEGORIES.map((c) => (
                <option key={c.id} value={c.id}>{c.emoji} {c.label}</option>
              ))}
            </select>

            {/* Contact status filter */}
            <select className="select-field" style={{ width: 'auto' }} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              <option value="all">All Statuses</option>
              {CONTACT_STATUSES.map((s) => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
          </div>

          <div style={{ display: 'flex', gap: '0.75rem', flexShrink: 0 }}>
            <button className="btn-success" onClick={handleExport} style={{ fontSize: '0.82rem', padding: '0.45rem 1rem' }}>
              <Download size={14} /> Export Excel
            </button>
            {confirmClear ? (
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button className="btn-secondary" style={{ fontSize: '0.82rem', padding: '0.45rem 0.75rem', color: '#ef4444', borderColor: '#ef4444' }} onClick={handleClear}>
                  Confirm Clear All
                </button>
                <button className="btn-secondary" style={{ fontSize: '0.82rem', padding: '0.45rem 0.75rem' }} onClick={() => setConfirmClear(false)}>
                  Cancel
                </button>
              </div>
            ) : (
              <button
                className="btn-secondary"
                style={{ fontSize: '0.82rem', padding: '0.45rem 1rem', color: '#ef4444' }}
                onClick={() => setConfirmClear(true)}
                disabled={leads.length === 0}
              >
                <Trash2 size={14} /> Clear All
              </button>
            )}
          </div>
        </div>

        <div style={{ marginTop: '0.75rem', fontSize: '0.8rem', color: '#64748b', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
          <span>Showing <strong>{filtered.length}</strong> of <strong>{leads.length}</strong> leads</span>
          {selectedIds.size > 0 && (
            <div style={{ display:'flex', alignItems:'center', gap:'0.75rem', background:'#ede9fe', border:'1px solid #c7d2fe', borderRadius:8, padding:'0.4rem 0.85rem', flexWrap:'wrap' }}>
              <span style={{ fontSize:'0.82rem', fontWeight:700, color:'#4338ca' }}>{selectedIds.size} selected</span>
              <button className="btn-primary" onClick={handleBuildAllSelected}
                style={{ fontSize:'0.78rem', padding:'0.3rem 0.75rem', display:'flex', alignItems:'center', gap:4 }}>
                <FileCode2 size={12} /> Build {selectedIds.size} Preview{selectedIds.size !== 1 ? 's' : ''}
              </button>
              <button className="btn-secondary" onClick={() => setSelectedIds(new Set())}
                style={{ fontSize:'0.78rem', padding:'0.3rem 0.6rem' }}>
                <X size={12} /> Deselect
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Table */}
      {leads.length === 0 ? (
        <div className="card" style={{ padding: '4rem', textAlign: 'center', color: '#94a3b8' }}>
          <Users size={52} style={{ display: 'block', margin: '0 auto 1rem', opacity: 0.3 }} />
          <h3 style={{ margin: '0 0 0.5rem', color: '#64748b' }}>No leads yet</h3>
          <p style={{ margin: '0 0 1.5rem', fontSize: '0.875rem' }}>
            Find businesses and click "Add to Lead Tracker" to start tracking.
          </p>
          <button className="btn-primary" onClick={() => navigate('/finder')}>
            Go to Finder
          </button>
        </div>
      ) : (
        <div className="card" style={{ overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <table>
              <thead>
                <tr>
                  <th style={{ width: 36 }}>
                    <input type="checkbox"
                      checked={selectedIds.size === filtered.length && filtered.length > 0}
                      onChange={handleSelectAll}
                      style={{ accentColor:'#6366f1', cursor:'pointer' }}
                    />
                  </th>
                  <th onClick={() => handleSort('name')} style={{ cursor: 'pointer', userSelect: 'none' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>Business <SortIcon field="name" /></span>
                  </th>
                  <th>Category</th>
                  <th>City</th>
                  <th>Contact</th>
                  <th>Website</th>
                  <th onClick={() => handleSort('leadScore')} style={{ cursor: 'pointer', userSelect: 'none' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>Score <SortIcon field="leadScore" /></span>
                  </th>
                  <th>Contact Status</th>
                  <th>Notes</th>
                  <th>Preview</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((lead) => {
                  const cat = CATEGORIES.find((c) => c.id === lead.category)
                  return (
                    <tr key={lead.id}>
                      <td>
                        <input type="checkbox"
                          checked={selectedIds.has(lead.id)}
                          onChange={() => handleToggleSelect(lead.id)}
                          style={{ accentColor:'#6366f1', cursor:'pointer' }}
                        />
                      </td>
                      <td>
                        <div style={{ fontWeight: 600, color: '#1e293b', fontSize: '0.875rem' }}>
                          {cat?.emoji} {lead.name}
                        </div>
                        {lead.locality && (
                          <div style={{ fontSize: '0.72rem', color: '#6366f1', fontWeight: 600, marginTop: 2 }}>
                            📍 {lead.locality}
                          </div>
                        )}
                        {lead.address && (
                          <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: 1 }}>
                            {lead.address.slice(0, 50)}{lead.address.length > 50 ? '…' : ''}
                          </div>
                        )}
                        {lead.subcategories && lead.subcategories.length > 0 && (
                          <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap', marginTop: 3 }}>
                            {lead.subcategories.slice(0, 2).map((s, idx) => (
                              <span key={idx} style={{ fontSize: '0.65rem', background: '#f8fafc', border: '1px solid #e2e8f0', color: '#64748b', padding: '0 4px', borderRadius: 3 }}>
                                {s}
                              </span>
                            ))}
                          </div>
                        )}
                      </td>
                      <td>
                        <span
                          style={{
                            fontSize: '0.75rem',
                            fontWeight: 600,
                            color: cat?.color || '#64748b',
                            background: cat?.bg || '#f3f4f6',
                            padding: '0.2rem 0.6rem',
                            borderRadius: 99,
                          }}
                        >
                          {cat?.label || lead.category}
                        </span>
                      </td>
                      <td style={{ fontSize: '0.82rem', color: '#64748b' }}>{lead.city || '—'}</td>
                      <td>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                          {lead.phone && (
                            <a href={`tel:${lead.phone}`} style={{ fontSize: '0.78rem', color: '#3b82f6', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 4 }}>
                              <Phone size={11} /> {lead.phone}
                            </a>
                          )}
                          {!lead.phone && <span style={{ fontSize: '0.78rem', color: '#cbd5e1' }}>No phone</span>}
                        </div>
                      </td>
                      <td>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                          {websiteStatusBadge(lead.websiteStatus)}
                          {lead.website && (
                            <a href={lead.website} target="_blank" rel="noopener noreferrer" style={{ fontSize: '0.72rem', color: '#6366f1', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 3 }}>
                              <ExternalLink size={10} /> Visit
                            </a>
                          )}
                        </div>
                      </td>
                      <td>
                        <span className={`badge badge-${lead.leadScore >= 70 ? 'high' : lead.leadScore >= 40 ? 'medium' : 'low'}`}>
                          🎯 {lead.leadScore}
                        </span>
                      </td>
                      <td>
                        <InlineEdit
                          value={lead.contactStatus}
                          type="select"
                          options={CONTACT_STATUSES}
                          onSave={(v) => updateLead(lead.id, { contactStatus: v })}
                        />
                      </td>
                      <td style={{ maxWidth: 200 }}>
                        <InlineEdit
                          value={lead.notes}
                          onSave={(v) => updateLead(lead.id, { notes: v })}
                        />
                      </td>
                      <td>
                        <button
                          onClick={() => handleBuildPreview(lead)}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6366f1',
                            display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.78rem', fontWeight: 600,
                            padding: '0.3rem 0.6rem', borderRadius: 6, transition: 'background 0.2s' }}
                          onMouseEnter={(e) => e.currentTarget.style.background = '#ede9fe'}
                          onMouseLeave={(e) => e.currentTarget.style.background = 'none'}
                        >
                          <FileCode2 size={13} /> Build
                        </button>
                      </td>
                      <td>
                        <button
                          onClick={() => {
                            removeLead(lead.id)
                            toast.success('Lead removed')
                          }}
                          style={{
                            background: 'none',
                            border: 'none',
                            cursor: 'pointer',
                            color: '#ef4444',
                            padding: '0.3rem',
                            borderRadius: 6,
                            transition: 'background 0.2s',
                          }}
                          onMouseEnter={(e) => e.currentTarget.style.background = '#fee2e2'}
                          onMouseLeave={(e) => e.currentTarget.style.background = 'none'}
                        >
                          <Trash2 size={15} />
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}