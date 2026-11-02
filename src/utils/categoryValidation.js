export const VALIDATION_STATUS = { ACCEPT: 'ACCEPT', REJECT: 'REJECT', REVIEW: 'REVIEW' }
export const VALIDATION_CONFIDENCE = { HIGH: 'HIGH', MEDIUM: 'MEDIUM', LOW: 'LOW' }

// Types that are never a commercial business in any category
const ALWAYS_REJECT = {
  park: 'Public park — not a commercial venue.',
  national_park: 'National park — not a commercial venue.',
  school: 'Educational institution — not a commercial venue.',
  primary_school: 'Educational institution — not a commercial venue.',
  secondary_school: 'Educational institution — not a commercial venue.',
  university: 'Educational institution — not a commercial venue.',
  hindu_temple: 'Religious institution — not a commercial venue.',
  mosque: 'Religious institution — not a commercial venue.',
  church: 'Religious institution — not a commercial venue.',
  place_of_worship: 'Religious institution — not a commercial venue.',
  hospital: 'Hospital — not a commercial venue.',
  cemetery: 'Cemetery — not a commercial venue.',
  campground: 'Campground — not a commercial venue.',
}

const CATEGORY_RULES = {
  gym: {
    accept: ['fitness_center', 'gym', 'sports_complex', 'athletic_field', 'sports_club'],
    reject: {
      yoga_studio: 'Yoga-only studio — not a general gym.',
      photo_studio: 'Photography studio — not a gym.',
      hair_salon: 'Hair salon — not a gym.',
      beauty_salon: 'Beauty salon — not a gym.',
      spa: 'Spa — not a gym.',
    },
  },
  salon: {
    accept: ['hair_salon', 'beauty_salon', 'barber_shop'],
    reject: {
      spa: 'Spa — not a salon.',
      gym: 'Gym — not a salon.',
      fitness_center: 'Fitness centre — not a salon.',
    },
  },
  spa: {
    accept: ['spa', 'massage'],
    reject: {
      hair_salon: 'Hair salon without spa evidence — not a spa.',
      barber_shop: 'Barber shop — not a spa.',
      photo_studio: 'Photography studio — not a spa.',
      gym: 'Gym — not a spa.',
      fitness_center: 'Fitness centre — not a spa.',
    },
  },
  turf: {
    accept: ['athletic_field', 'sports_complex', 'sports_club', 'stadium'],
    reject: {
      park: 'Public park — not a commercial turf.',
      school: 'Educational institution — not a commercial turf.',
      primary_school: 'Educational institution — not a commercial turf.',
      secondary_school: 'Educational institution — not a commercial turf.',
    },
  },
  travel: {
    accept: ['travel_agency', 'tourist_attraction', 'tour_operator'],
    reject: {
      restaurant: 'Restaurant — not a travel agency.',
      lodging: 'Lodging — not a travel agency.',
    },
  },
}

const SPA_NAME_HINTS = /\b(spa|massage|ayurved|wellness|therapy|therapist|relaxation|beauty spa|day spa)\b/i
const GYM_NAME_HINTS = /\b(gym|fitness|bodybuilding|crossfit|workout|strength|powerhouse|iron)\b/i
const SALON_NAME_HINTS = /\b(salon|barber|hair|beauty parlour|parlor|unisex)\b/i
const TURF_NAME_HINTS = /\b(turf|cricket|football|futsal|box cricket|sports arena|sports complex|playground)\b/i
const TRAVEL_NAME_HINTS = /\b(travel|tours?|holidays?|trip|tourism|agency|travels)\b/i

const NAME_HINTS = { gym: GYM_NAME_HINTS, salon: SALON_NAME_HINTS, spa: SPA_NAME_HINTS, turf: TURF_NAME_HINTS, travel: TRAVEL_NAME_HINTS }

export function validateBusinessCategory({ name = '', primaryType, types = [] }, categoryId) {
  const allTypes = [primaryType, ...types].filter(Boolean)
  const rules = CATEGORY_RULES[categoryId]
  if (!rules) return { status: VALIDATION_STATUS.REVIEW, confidence: VALIDATION_CONFIDENCE.LOW, reason: 'Unknown category.' }

  // Check global rejects first
  for (const t of allTypes) {
    if (ALWAYS_REJECT[t] && !rules.accept.includes(t)) {
      return { status: VALIDATION_STATUS.REJECT, confidence: VALIDATION_CONFIDENCE.HIGH, reason: ALWAYS_REJECT[t] }
    }
  }

  // Category-specific rejects (only if not also in accept list)
  for (const t of allTypes) {
    if (rules.reject[t] && !rules.accept.some((a) => allTypes.includes(a))) {
      return { status: VALIDATION_STATUS.REJECT, confidence: VALIDATION_CONFIDENCE.HIGH, reason: rules.reject[t] }
    }
  }

  // Special: spa category — a beauty_salon with spa in types or name is ok
  if (categoryId === 'spa') {
    const hasSpaType = allTypes.includes('spa') || allTypes.includes('massage')
    const hasSpaName = SPA_NAME_HINTS.test(name)
    if (!hasSpaType && !hasSpaName) {
      const isSalonOnly = allTypes.some((t) => ['hair_salon', 'beauty_salon', 'barber_shop'].includes(t))
      if (isSalonOnly) return { status: VALIDATION_STATUS.REJECT, confidence: VALIDATION_CONFIDENCE.HIGH, reason: 'Hair/beauty salon without spa evidence — not a spa.' }
    }
  }

  // Accept by type
  if (allTypes.some((t) => rules.accept.includes(t))) {
    return { status: VALIDATION_STATUS.ACCEPT, confidence: VALIDATION_CONFIDENCE.HIGH, reason: `Confirmed ${categoryId} type.` }
  }

  // Accept by name hint
  const hint = NAME_HINTS[categoryId]
  if (hint && hint.test(name)) {
    return { status: VALIDATION_STATUS.ACCEPT, confidence: VALIDATION_CONFIDENCE.MEDIUM, reason: `Name suggests ${categoryId}.` }
  }

  // Insufficient evidence
  if (!primaryType || allTypes.every((t) => ['point_of_interest', 'establishment'].includes(t))) {
    return { status: VALIDATION_STATUS.REVIEW, confidence: VALIDATION_CONFIDENCE.LOW, reason: 'Insufficient evidence to confirm category.' }
  }

  return { status: VALIDATION_STATUS.REVIEW, confidence: VALIDATION_CONFIDENCE.MEDIUM, reason: `Could not confirm as ${categoryId}.` }
}
