import { useLocation } from 'react-router-dom'

const PAGE_TITLES = { '/': ['Overview', 'Your business discovery workspace'], '/finder': ['Business Finder', 'Search, compare, and start conversations'], '/leads': ['Lead Tracker', 'Keep every opportunity moving'], '/templates': ['Website Builder', 'Shape a professional first impression'], '/settings': ['Settings', 'Manage your workspace'] }

export default function Header() {
  const location = useLocation()
  const [title, subtitle] = PAGE_TITLES[location.pathname] || PAGE_TITLES['/']
  return <header className="workspace-header">
    <div className="header-title"><span className="header-breadcrumb">WORKSPACE <span>/</span> {title.toUpperCase()}</span><strong>{subtitle}</strong></div>
    <div className="header-actions"><span className="service-indicator"><i/> Places search ready</span></div>
  </header>
}