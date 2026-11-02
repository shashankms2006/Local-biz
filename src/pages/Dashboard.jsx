import { useNavigate } from 'react-router-dom'
import useStore from '../store/useStore'
import { CATEGORIES } from '../utils/categories'
import { ArrowRight, ArrowUpRight, Dumbbell, Leaf, MapPin, Plane, Scissors, Sparkles, Waves, Users, Globe2, CircleCheck, Target } from 'lucide-react'

const CATEGORY_ICONS = { salon: Scissors, spa: Waves, gym: Dumbbell, turf: Leaf, travel: Plane }

export default function Dashboard() {
  const navigate = useNavigate()
  const leads = useStore((state) => state.leads)
  const stats = [
    { label: 'Leads saved', value: leads.length, icon: Users, tone: 'violet' },
    { label: 'No website found', value: leads.filter((lead) => lead.websiteStatus === 'no_website').length, icon: Globe2, tone: 'amber' },
    { label: 'Website active', value: leads.filter((lead) => lead.websiteStatus === 'active').length, icon: CircleCheck, tone: 'green' },
    { label: 'Deals closed', value: leads.filter((lead) => lead.contactStatus === 'deal_closed').length, icon: Target, tone: 'blue' },
  ]
  const recentLeads = [...leads].sort((a, b) => new Date(b.addedAt) - new Date(a.addedAt)).slice(0, 5)

  return <div className="dashboard-page">
    <section className="dashboard-hero">
      <div className="dashboard-hero-copy">
        <span className="eyebrow"><Sparkles size={14}/> LOCAL BUSINESS WORKSPACE</span>
        <h2>Find your next<br/><em>great client.</em></h2>
        <p>Discover local businesses, understand their online presence, and keep every opportunity moving.</p>
        <button className="dashboard-primary" onClick={() => navigate('/finder')}>Explore businesses <ArrowRight size={17}/></button>
      </div>
      <div className="dashboard-hero-art" aria-hidden="true">
        <div className="hero-art-orbit orbit-one"/><div className="hero-art-orbit orbit-two"/>
        <div className="hero-art-card"><span>YOUR PIPELINE</span><strong>{leads.length.toString().padStart(2, '0')}</strong><small>businesses to explore</small><div className="hero-art-bars"><i/><i/><i/><i/><i/><i/><i/><i/></div></div>
        <span className="hero-art-pin"><MapPin size={23}/></span>
      </div>
      <span className="dashboard-hero-index">01 / DISCOVER</span>
    </section>

    <section className="dashboard-stats" aria-label="Lead overview">
      {stats.map(({ label, value, icon: Icon, tone }) => <article className="dashboard-stat" key={label}>
        <span className={`dashboard-stat-icon ${tone}`}><Icon size={19}/></span><div><strong>{value}</strong><span>{label}</span></div><ArrowUpRight className="stat-arrow" size={16}/>
      </article>)}
    </section>

    <div className="dashboard-columns">
      <section className="dashboard-panel categories-panel">
        <div className="panel-heading"><div><span className="eyebrow">START A SEARCH</span><h3>Choose a category</h3></div><span className="panel-count">05 CATEGORIES</span></div>
        <div className="category-launch-grid">{CATEGORIES.map((category, index) => {
          const Icon = CATEGORY_ICONS[category.id] || MapPin
          return <button className="category-launch" key={category.id} style={{ '--category-color': category.color, '--category-tint': category.bg }} onClick={() => { useStore.getState().setSearchCategory(category.id); navigate('/finder') }}>
            <span className="category-launch-number">0{index + 1}</span><span className="category-launch-icon"><Icon size={20}/></span><span className="category-launch-name">{category.label}</span><ArrowRight className="category-launch-arrow" size={17}/>
          </button>
        })}</div>
        <button className="text-action" onClick={() => navigate('/finder')}>Open Business Finder <ArrowRight size={15}/></button>
      </section>

      <section className="dashboard-panel recent-panel">
        <div className="panel-heading"><div><span className="eyebrow">YOUR PIPELINE</span><h3>Recent leads</h3></div><button className="quiet-action" onClick={() => navigate('/leads')}>View all <ArrowUpRight size={14}/></button></div>
        {recentLeads.length === 0 ? <div className="recent-empty"><span><Users size={23}/></span><strong>Your pipeline starts here</strong><p>Save a business from Finder and it will appear here for follow up.</p><button className="text-action" onClick={() => navigate('/finder')}>Find businesses <ArrowRight size={15}/></button></div> : <div className="recent-list">{recentLeads.map((lead) => {
          const category = CATEGORIES.find((item) => item.id === lead.category)
          const Icon = CATEGORY_ICONS[lead.category] || MapPin
          return <article className="recent-row" key={lead.id}><span className="recent-icon" style={{ '--category-color': category?.color || '#73809b', '--category-tint': category?.bg || '#f1f4f7' }}><Icon size={17}/></span><span className="recent-copy"><strong>{lead.name}</strong><small>{lead.city || lead.address?.split(',')[0] || category?.label || 'Local business'}</small></span><span className={`website-state state-${lead.websiteStatus || 'unknown'}`}>{lead.websiteStatus === 'active' ? 'Active site' : lead.websiteStatus === 'inactive' ? 'Inactive' : 'No site'}</span></article>
        })}</div>}
      </section>
    </div>
    <section className="dashboard-flow"><div><span className="eyebrow">A SIMPLE WORKFLOW</span><h3>From discovery to a real conversation.</h3></div><div className="flow-steps"><span><b>01</b> Search locally</span><span><b>02</b> Review the opportunity</span><span><b>03</b> Reach out and track</span></div></section>
  </div>
}