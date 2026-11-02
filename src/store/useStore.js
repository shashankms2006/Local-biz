import { create } from 'zustand'

const useStore = create((set, get) => ({
  // ── Finder state ─────────────────────────────────────────────────────────
  businesses: (() => { try { return JSON.parse(localStorage.getItem('biz_businesses') || '[]') } catch { return [] } })(),
  searchCity: '',
  searchCategory: '',
  isLoading: false,
  searchError: null,
  websiteFilter: 'all',
  sortBy: 'leadScore',

  setBusinesses: (businesses) => { localStorage.setItem('biz_businesses', JSON.stringify(businesses)); set({ businesses }) },

  appendBusinesses: (newBizinesses) =>
    set((state) => {
      const existingIds = new Set(state.businesses.map((b) => b.id))
      const unique = newBizinesses.filter((b) => !existingIds.has(b.id))
      const businesses = [...state.businesses, ...unique]
      localStorage.setItem('biz_businesses', JSON.stringify(businesses))
      return { businesses }
    }),

  setSearchCity: (searchCity) => set({ searchCity }),
  setSearchCategory: (searchCategory) => set({ searchCategory }),
  setIsLoading: (isLoading) => set({ isLoading }),
  setSearchError: (searchError) => set({ searchError }),
  setWebsiteFilter: (websiteFilter) => set({ websiteFilter }),
  setSortBy: (sortBy) => set({ sortBy }),

  // Update a single business's website status + lead score
  updateBusiness: (id, updates) =>
    set((state) => {
      const businesses = state.businesses.map((b) => b.id === id ? { ...b, ...updates } : b)
      localStorage.setItem('biz_businesses', JSON.stringify(businesses))
      return { businesses }
    }),

  // ── Lead tracker state ────────────────────────────────────────────────────
  leads: (() => {
    try {
      return JSON.parse(localStorage.getItem('biz_leads') || '[]')
    } catch {
      return []
    }
  })(),

  addLead: (business) => {
    const leads = get().leads
    const exists = leads.find((l) => l.id === business.id)
    if (exists) return false
    const newLeads = [
      ...leads,
      {
        ...business,
        contactStatus: 'not_contacted',
        notes: '',
        previewLink: '',
        addedAt: new Date().toISOString(),
      },
    ]
    localStorage.setItem('biz_leads', JSON.stringify(newLeads))
    set({ leads: newLeads })
    return true
  },

  removeLead: (id) => {
    const newLeads = get().leads.filter((l) => l.id !== id)
    localStorage.setItem('biz_leads', JSON.stringify(newLeads))
    set({ leads: newLeads })
  },

  updateLead: (id, updates) => {
    const newLeads = get().leads.map((l) =>
      l.id === id ? { ...l, ...updates } : l
    )
    localStorage.setItem('biz_leads', JSON.stringify(newLeads))
    set({ leads: newLeads })
  },

  clearAllLeads: () => {
    localStorage.removeItem('biz_leads')
    set({ leads: [] })
  },

  // ── Template builder state ────────────────────────────────────────────────
  selectedTemplate: null,
  templateData: {},
  setSelectedTemplate: (selectedTemplate) => set({ selectedTemplate }),
  setTemplateData: (templateData) => set({ templateData }),
}))

export default useStore