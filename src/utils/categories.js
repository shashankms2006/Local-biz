// Category labels and colors for the interface. Search phrases stay server-side.
export const CATEGORIES = [
  { id: 'salon', label: 'Salons', emoji: '✂️', color: '#bd4778', bg: '#fdf2f8' },
  { id: 'spa', label: 'Spas', emoji: '🧖', color: '#7d68b1', bg: '#f5f3ff' },
  { id: 'gym', label: 'Gyms', emoji: '🏋️', color: '#ad7b22', bg: '#fffbeb' },
  { id: 'turf', label: 'Turfs & Playgrounds', emoji: '⚽', color: '#36896d', bg: '#ecfdf5' },
  { id: 'travel', label: 'Tours & Travels', emoji: '✈️', color: '#397bad', bg: '#eff6ff' },
]

export const getCategoryById = (id) => CATEGORIES.find((category) => category.id === id)

export const CONTACT_STATUSES = [
  { value: 'not_contacted', label: 'Not Contacted', color: '#6b7280', bg: '#f3f4f6' },
  { value: 'contacted', label: 'Contacted', color: '#3b82f6', bg: '#dbeafe' },
  { value: 'interested', label: 'Interested', color: '#f59e0b', bg: '#fef3c7' },
  { value: 'deal_closed', label: 'Deal Closed', color: '#10b981', bg: '#d1fae5' },
  { value: 'not_interested', label: 'Not Interested', color: '#ef4444', bg: '#fee2e2' },
]

export const getContactStatus = (value) => CONTACT_STATUSES.find((status) => status.value === value) || CONTACT_STATUSES[0]