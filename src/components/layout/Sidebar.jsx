import { useState } from 'react'
import { Link, NavLink } from 'react-router-dom'
import { BriefcaseBusiness, ChevronLeft, ChevronRight, LayoutDashboard, MapPin, Settings, Users } from 'lucide-react'

const navItems = [
  { path: '/', icon: LayoutDashboard, label: 'Overview', end: true },
  { path: '/finder', icon: MapPin, label: 'Business Finder' },
  { path: '/leads', icon: Users, label: 'Lead Tracker' },
  { path: '/settings', icon: Settings, label: 'Settings' },
]

export default function Sidebar() {
  const [collapsed, setCollapsed] = useState(false)
  return <aside className={`workspace-sidebar ${collapsed ? 'is-collapsed' : ''}`}>
    <Link className="workspace-brand" to="/" aria-label="BizFinder home"><span className="workspace-brand-mark"><BriefcaseBusiness size={19}/></span>{!collapsed && <span><strong>BizFinder</strong><small>LOCAL BUSINESS STUDIO</small></span>}</Link>
    <span className="sidebar-section-label">WORKSPACE</span>
    <nav className="workspace-nav" aria-label="Main navigation">{navItems.map(({ path, icon: Icon, label, end }) => <NavLink key={path} to={path} end={end} title={collapsed ? label : undefined} className={({ isActive }) => `workspace-nav-link ${isActive ? 'is-active' : ''}`}><Icon size={18}/>{!collapsed && <span>{label}</span>}{!collapsed && path === '/finder' && <small className="nav-live-dot"/>}</NavLink>)}</nav>
    {!collapsed && <div className="sidebar-bottom"><div className="sidebar-note"><span className="sidebar-note-icon"><MapPin size={15}/></span><strong>Local knowledge,<br/>better outreach.</strong><small>Find the businesses that could use your help.</small></div><span className="sidebar-version">BIZFINDER STUDIO <span>•</span> 1.0</span></div>}
    <button type="button" className="sidebar-collapse" onClick={() => setCollapsed((value) => !value)} aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}>{collapsed ? <ChevronRight size={15}/> : <ChevronLeft size={15}/>}</button>
  </aside>
}