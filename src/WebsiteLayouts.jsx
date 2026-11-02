import { useEffect, useRef, useState } from 'react'
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUpRight, Clock3, MapPin, Phone, Star, X } from 'lucide-react'

export function Visual({ photo, business, theme, className = '' }) {
  const [failed, setFailed] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const imageSrc = photo?.url || (photo?.name ? `/api/places/photo?name=${encodeURIComponent(photo.name)}&width=1600` : '')
  return photo && !failed
    ? <div className={`site-visual-frame ${className}`}><span className={`site-image-skeleton ${loaded ? 'is-hidden' : ''}`} aria-hidden="true"/><img className={`site-visual ${loaded ? 'is-loaded' : ''}`} src={imageSrc} alt={photo.alt || `Illustrative ${business.category} image`} loading={['hero-photo','collage-main','immersive-bg'].includes(className) ? 'eager' : 'lazy'} fetchPriority={['hero-photo','collage-main','immersive-bg'].includes(className) ? 'high' : 'auto'} onLoad={() => setLoaded(true)} onError={() => setFailed(true)} /></div>
    : <div className={`site-visual site-visual-fallback ${className}`} aria-label={`${theme.visualLabel} visual`}><span>{theme.visualLabel}</span><i/><b/></div>
}

function Reveal({ children, className = '', motion = 'spa' }) {
  const [visible, setVisible] = useState(false)
  const ref = useRef(null)
  useEffect(() => {
    const node = ref.current
    if (!node) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches || !('IntersectionObserver' in window)) { setVisible(true); return }
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) { setVisible(true); observer.disconnect() }
    }, { threshold: 0.12 })
    observer.observe(node)
    return () => observer.disconnect()
  }, [])
  return <div ref={ref} data-motion={motion} className={`site-reveal ${visible ? 'is-visible' : ''} ${className}`}>{children}</div>
}

export function ScrollReveals({ motion }) {
  useEffect(() => {
    const sections = [...document.querySelectorAll('.generated-site > section:not(.site-hero)')]
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches || !('IntersectionObserver' in window)) {
      sections.forEach((section) => section.classList.add('is-inview'))
      return
    }
    const observer = new IntersectionObserver((entries) => entries.forEach((entry) => {
      if (entry.isIntersecting) { entry.target.classList.add('is-inview'); observer.unobserve(entry.target) }
    }), { threshold: 0.1 })
    sections.forEach((section) => { section.classList.add('site-scroll-reveal'); section.dataset.motion = motion; observer.observe(section) })
    return () => observer.disconnect()
  }, [motion])
  return null
}

export function SiteNav({ business, theme, maps }) {
  return <header className="site-nav"><a className="site-brand" href="#top">{business.name}</a><nav aria-label="Main navigation"><a href="#visit">Contact</a>{maps && <a className="nav-cta" href={maps} target="_blank" rel="noreferrer">Directions <ArrowUpRight size={15}/></a>}</nav></header>
}

export function ActionLinks({ business, phone, whatsapp, maps, theme }) {
  return <div className="site-actions">{phone && <a className="site-button primary" href={`tel:${phone}`}><Phone size={16}/> Call {business.phone}</a>}{whatsapp && <a className="site-button outline" href={whatsapp} target="_blank" rel="noreferrer">WhatsApp enquiry <ArrowUpRight size={16}/></a>}{maps && <a className="site-button outline" href={maps} target="_blank" rel="noreferrer"><MapPin size={16}/> Directions</a>}</div>
}

export function Details({ business, address }) {
  const openingHours = typeof business.openingHours === 'string' ? business.openingHours : Array.isArray(business.openingHours) ? business.openingHours.join('; ') : ''
  return <div className="site-facts">{business.rating != null && <div><Star size={17} fill="currentColor"/> <strong>{business.rating}</strong>{business.reviewCount != null && <span> · {business.reviewCount} Google reviews</span>}</div>}{openingHours && <div><Clock3 size={17}/><span>{openingHours.replace(/;\s*/g, ' · ')}</span></div>}{address && <div><MapPin size={17}/><span>{address}</span></div>}</div>
}

export function Gallery({ photos, business, theme }) {
  if (!photos.length) return null
  return <section className="site-gallery" aria-label="Illustrative photography"><div className="site-section-heading"><span>THE SPACE</span><h2>Take a closer look</h2></div><div className="site-gallery-grid">{photos.slice(0, 4).map((photo, index) => <Reveal key={photo.url || photo.name} className="gallery-reveal" motion={theme.motion}><figure><button className="gallery-open" type="button" onClick={() => window.dispatchEvent(new CustomEvent('open-business-photo', { detail: index }))} aria-label={`Open illustrative image ${index + 1}`}><Visual photo={photo} business={business} theme={theme}/><span className="gallery-hover-label">View photo</span></button>{photo.attributions?.length > 0 && <figcaption>{photo.attributions.map((author, i) => <span key={`${author.uri || author.displayName}-${i}`}>{i > 0 && ' · '}{author.uri ? <a href={author.uri} target="_blank" rel="noreferrer">{author.displayName || 'Photo author'}</a> : author.displayName}</span>)}</figcaption>}</figure></Reveal>)}</div><small>Illustrative stock photos via Unsplash{photos[0]?.googleMapsUri && <> · <a href={photos[0].googleMapsUri} target="_blank" rel="noreferrer">View source on Google Maps</a></>}</small><PhotoLightbox photos={photos} business={business} theme={theme}/></section>
}

function PhotoLightbox({ photos, business, theme }) {
  const [index, setIndex] = useState(-1)
  useEffect(() => {
    if (index < 0) return
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = previousOverflow }
  }, [index])
  useEffect(() => {
    const open = (event) => setIndex(event.detail)
    window.addEventListener('open-business-photo', open)
    return () => window.removeEventListener('open-business-photo', open)
  }, [])
  useEffect(() => {
    if (index < 0) return
    const key = (event) => {
      if (event.key === 'Escape') setIndex(-1)
      if (event.key === 'ArrowRight') setIndex((value) => (value + 1) % photos.length)
      if (event.key === 'ArrowLeft') setIndex((value) => (value - 1 + photos.length) % photos.length)
    }
    window.addEventListener('keydown', key)
    return () => window.removeEventListener('keydown', key)
  }, [index, photos.length])
  if (index < 0 || !photos[index]) return null
  const photo = photos[index]
  return <div className="photo-lightbox" role="dialog" aria-modal="true" aria-label={`${business.name} photo gallery`} onClick={() => setIndex(-1)}><button autoFocus className="lightbox-close" type="button" aria-label="Close gallery" onClick={() => setIndex(-1)}><X/></button>{photos.length > 1 && <button className="lightbox-prev" type="button" aria-label="Previous photo" onClick={(e) => { e.stopPropagation(); setIndex((index - 1 + photos.length) % photos.length) }}><ArrowLeft/></button>}<div className="lightbox-content" onClick={(e) => e.stopPropagation()}><Visual photo={photo} business={business} theme={theme}/><p>{photo.attributions?.map((author, i) => <span key={i}>{i > 0 && ' · '}{author.uri ? <a href={author.uri} target="_blank" rel="noreferrer">{author.displayName || 'Photo author'}</a> : author.displayName}</span>)}{photo.googleMapsUri && <> · <a href={photo.googleMapsUri} target="_blank" rel="noreferrer">Google Maps source</a></>}</p></div>{photos.length > 1 && <button className="lightbox-next" type="button" aria-label="Next photo" onClick={(e) => { e.stopPropagation(); setIndex((index + 1) % photos.length) }}><ArrowRight/></button>}</div>
}

export function Contact({ business, theme, phone, whatsapp, maps, address }) {
  return <section className="site-contact" id="visit"><div><span className="site-kicker">COME SAY HELLO</span><h2>{business.locality || business.city || 'Find your way here'}</h2><p>{address || 'Contact us for location details.'}</p><ActionLinks business={business} phone={phone} whatsapp={whatsapp} maps={maps} theme={theme}/></div><Details business={business} address={address}/></section>
}

export function EditorialLayout(props) {
  const { business, theme, photos, address, phone, whatsapp, maps } = props
  return <><SiteNav {...props}/><section className="layout-editorial site-hero" id="top"><div className="editorial-copy"><span className="site-kicker">{theme.signature} · {business.primaryTypeDisplayName || business.category}</span><h1>{business.name}</h1><p>{business.description || address || `Discover ${business.name}.`}</p><ActionLinks {...props}/><Details business={business} address={address}/></div><div className="editorial-image"><Visual photo={photos[0]} business={business} theme={theme} className="hero-photo"/><span className="image-stamp">{theme.visualLabel}</span></div></section><section id="story" className="editorial-note"><span>LOCAL, PERSONAL, YOURS</span><p>{business.description || `${business.name} welcomes enquiries from the local community. Reach out directly to learn more.`}</p></section><Gallery {...props}/><Contact {...props}/></>
}

export function BotanicalLayout(props) {
  const { business, theme, photos, address } = props
  return <><SiteNav {...props}/><section className="layout-botanical site-hero" id="top"><div className="botanical-orbit"/><div className="botanical-copy"><span className="site-kicker">{theme.signature} / {business.city || 'NEAR YOU'}</span><h1>{business.name}</h1><p>{business.description || address || `A local ${business.category} business. Get in touch to find out more.`}</p><ActionLinks {...props}/></div><div className="botanical-collage"><Visual photo={photos[0]} business={business} theme={theme} className="collage-main"/>{photos[1] && <Visual photo={photos[1]} business={business} theme={theme} className="collage-small"/>}<div className="collage-caption">{business.locality || business.city || theme.visualLabel}</div></div></section><section id="story" className="botanical-info"><div><span className="site-kicker">A LITTLE ABOUT US</span><h2>Rooted in {business.city || 'your neighbourhood'}</h2></div><p>{business.description || `Find ${business.name} in ${address || business.city || 'the local area'}. Contact the team for current services and availability.`}</p></section><Gallery {...props}/><Contact {...props}/></>
}

export function SplitLayout(props) {
  const { business, theme, photos, address } = props
  return <><SiteNav {...props}/><section className="layout-split site-hero" id="top"><div className="split-visual"><Visual photo={photos[0]} business={business} theme={theme} className="hero-photo"/><div className="split-index">01 / {theme.signature}</div></div><div className="split-copy"><span className="site-kicker">{business.primaryTypeDisplayName || business.category}</span><h1>{business.name}</h1><p>{business.description || `Meet ${business.name}, located in ${address || business.city || 'your area'}. Contact the business for details.`}</p><ActionLinks {...props}/><div className="split-verified"><Details business={business} address={address}/></div></div></section><section id="story" className="split-band"><span>GOOD TO KNOW</span><p>{address || business.city || 'Local business'}{business.website && <> · <a href={business.website} target="_blank" rel="noreferrer">Official website <ArrowUpRight size={13}/></a></>}</p></section><Gallery {...props}/><Contact {...props}/></>
}

export function ImmersiveLayout(props) {
  const { business, theme, photos, address } = props
  return <><SiteNav {...props}/><section className="layout-immersive site-hero" id="top"><Visual photo={photos[0]} business={business} theme={theme} className="immersive-bg"/><div className="immersive-shade"/><div className="immersive-copy"><span className="site-kicker">{theme.signature} — {business.city || business.category}</span><h1>{business.name}</h1><p>{business.description || address || 'A local business, ready to hear from you.'}</p><ActionLinks {...props}/></div><a className="scroll-cue" href="#story">Explore <ArrowDown size={16}/></a></section><section id="story" className="immersive-story"><span className="site-kicker">THE PLACE</span><h2>{business.locality || business.city || business.name}</h2><p>{business.description || `${business.name} is based at ${address || business.city || 'a local address'}. Get in touch for verified details and availability.`}</p><Details business={business} address={address}/></section><Gallery {...props}/><Contact {...props}/></>
}

export const layoutComponents = { editorial: EditorialLayout, botanical: BotanicalLayout, split: SplitLayout, immersive: ImmersiveLayout }