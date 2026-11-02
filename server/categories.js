// Dashboard categories -> Text Search phrases sent to Google Places ("<term> in <city>").
// The ids must match src/utils/categories.js.
export const CATEGORY_DEFS = {
  salon: { label: 'Salons', terms: ['salon', 'barber shop'] },
  spa: { label: 'Spas', terms: ['spa', 'massage centre'] },
  gym: { label: 'Gyms', terms: ['gym', 'fitness centre'] },
  turf: { label: 'Turfs & Playgrounds', terms: ['turf', 'playground', 'box cricket'] },
  travel: { label: 'Tours & Travels', terms: ['travel agency', 'tours and travels'] },
}