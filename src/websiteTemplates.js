const palette = {
  spa: { bg:'#f2efe7', ink:'#25392f', accent:'#9a7655', muted:'#d9dfd2', display:'Georgia,serif', body:'Arial,sans-serif', signature:'RESTORE & RESET', visualLabel:'WELLNESS', motion:'spa' },
  salon: { bg:'#f8f1f3', ink:'#281a22', accent:'#b44470', muted:'#ead6df', display:'Georgia,serif', body:'Arial,sans-serif', signature:'PERSONAL STYLE', visualLabel:'BEAUTY STUDIO', motion:'salon' },
  gym: { bg:'#101516', ink:'#f4f2e9', accent:'#c5f251', muted:'#293232', display:'Impact,Arial,sans-serif', body:'Arial,sans-serif', signature:'SHOW UP STRONG', visualLabel:'TRAINING', motion:'gym' },
  turf: { bg:'#12332e', ink:'#f4f4e9', accent:'#c1fa55', muted:'#234a40', display:'Impact,Arial,sans-serif', body:'Arial,sans-serif', signature:'YOUR NEXT GAME', visualLabel:'SPORTS GROUND', motion:'turf' },
  travel: { bg:'#edf3f0', ink:'#173a40', accent:'#cc6d4b', muted:'#d5e1dc', display:'Georgia,serif', body:'Arial,sans-serif', signature:'GO A LITTLE FURTHER', visualLabel:'TRAVEL', motion:'travel' },
}
const definitions = [
  ['spa','spa-01','Luxury Wellness Editorial','spa01'],['spa','spa-02','Minimal Spa House','spa02'],['spa','spa-03','Garden Wellness Retreat','spa03'],['spa','spa-04','After Dark Sanctuary','spa04'],
  ['salon','salon-01','The Fashion Edit','salon01'],['salon','salon-02','Form Beauty Studio','salon02'],['salon','salon-03','Creative Hair Atelier','salon03'],['salon','salon-04','Beauty Boutique','salon04'],
  ['gym','gym-01','Training Manifesto','gym01'],['gym','gym-02','Performance Lab','gym02'],['gym','gym-03','Modern Fitness Club','gym03'],['gym','gym-04','Neighbourhood Movement','gym04'],
  ['turf','turf-01','The Home Ground','turf01'],['turf','turf-02','Match Day Tournament','turf02'],['turf','turf-03','Recreation Grounds','turf03'],['turf','turf-04','Community Sports Space','turf04'],
  ['travel','travel-01','The Travel Journal','travel01'],['travel','travel-02','Field Notes Expedition','travel02'],['travel','travel-03','Travel Concierge','travel03'],['travel','travel-04','Private Holiday Planner','travel04'],
]
const templateAccents = {
  'spa-01':['#f3efe7','#25392f','#9a7655','#dce1d6','Georgia,serif'], 'spa-02':['#f8f6f1','#353a34','#9c8c76','#e8e4dc','Arial,sans-serif'], 'spa-03':['#e9f0e7','#294034','#6e866b','#d2dfd0','Georgia,serif'], 'spa-04':['#171b1a','#f3eee5','#c0a477','#303936','Georgia,serif'],
  'salon-01':['#f7f0ed','#291e1d','#b75c4b','#ead9d2','Georgia,serif'], 'salon-02':['#fbf9f6','#2e2d2a','#8a7069','#eee9e3','Arial,sans-serif'], 'salon-03':['#f5e9fc','#22182b','#d74089','#edc7e4','Impact,Arial,sans-serif'], 'salon-04':['#f4e9e4','#3d2924','#aa6c53','#e5cfc3','Georgia,serif'],
  'gym-01':['#d7ff3f','#15191a','#15191a','#bde534','Impact,Arial,sans-serif'], 'gym-02':['#111516','#f2f3ef','#d0fa4b','#293334','Arial,sans-serif'], 'gym-03':['#f3f5f2','#1d2b27','#58856f','#dce6df','Arial,sans-serif'], 'gym-04':['#e9e7fb','#26244a','#766ce0','#d9d5f4','Georgia,serif'],
  'turf-01':['#12382e','#f1f5e8','#c9f35b','#245446','Impact,Arial,sans-serif'], 'turf-02':['#e7f2e9','#1d352d','#cf442f','#cddfd0','Arial,sans-serif'], 'turf-03':['#f4f1e8','#263a2d','#8eaa4c','#dfe3d0','Georgia,serif'], 'turf-04':['#163b39','#faf3df','#f0b947','#315452','Arial,sans-serif'],
  'travel-01':['#f3f0e8','#213c43','#cb7655','#d9e2dc','Georgia,serif'], 'travel-02':['#e9eee5','#273b33','#b66a42','#d1dfd2','Arial,sans-serif'], 'travel-03':['#f8f7f2','#1e3a43','#597d82','#e1e7e3','Arial,sans-serif'], 'travel-04':['#ede7dc','#282d32','#a27d58','#d8cbb8','Georgia,serif'],
}
export const WEBSITE_TEMPLATES = definitions.map(([category,id,name,layout]) => {
  const [bg, ink, accent, muted, display] = templateAccents[id]
  return { id, category, name, layout, theme: { ...palette[category], bg, ink, accent, muted, display } }
})
export const templateById = (id) => WEBSITE_TEMPLATES.find((item) => item.id === id)
export function chooseTemplate(category, placeId, seed, recent = []) {
  const pool = WEBSITE_TEMPLATES.filter((item) => item.category === category)
  const hash = [...`${placeId}:${seed}`].reduce((value, char) => (value * 31 + char.charCodeAt(0)) >>> 0, 11)
  const start = hash % pool.length
  for (let step = 0; step < pool.length; step++) {
    const item = pool[(start + step) % pool.length]
    if (!recent.includes(item.id)) return item
  }
  return pool[start]
}