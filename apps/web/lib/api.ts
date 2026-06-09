// In local dev, NEXT_PUBLIC_API_URL is set via .env.local → http://localhost:4000/v1
// In production (Vercel), set NEXT_PUBLIC_API_URL in Vercel dashboard, or it
// falls back to the Railway URL below so login always works.
const BASE = (process.env.NEXT_PUBLIC_API_URL || '').replace(/\/+$/, '') // strip any accidental trailing slash

function getToken(): string | null {
  if (typeof window === 'undefined') return null
  return localStorage.getItem('accessToken')
}

async function request<T>(path: string, opts: RequestInit = {}): Promise<T> {
  const token = getToken()
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(opts.headers as Record<string, string> || {}),
  }

  const res = await fetch(`${BASE}${path}`, { ...opts, headers, credentials: 'include' })

  if (!res.ok) {
    if (res.status === 401) {
      if (typeof window !== 'undefined') {
        localStorage.removeItem('accessToken')
        localStorage.removeItem('authUser')
        const pathname = window.location.pathname
        if (!pathname.startsWith('/login') && !pathname.startsWith('/menu')) {
          window.location.href = '/login?error=session_expired'
        }
      }
    }
    const body = await res.json().catch(() => ({ error: res.statusText }))
    throw new Error(body.error || `HTTP ${res.status}`)
  }

  if (res.status === 204) return {} as T
  return res.json()
}

export const api = {
  // Auth
  login: (email: string, password: string) =>
    request<{ accessToken: string; user: { id: string; email: string; role: string; restaurantId: string | null; restaurantSlug: string | null } }>(
      '/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }
    ),
  me: () => request('/auth/me'),
  logout: () => request('/auth/logout', { method: 'POST' }),

  // Resolve restaurant by slug (used by vendor portal)
  lookupRestaurant: (slug: string) => request<{ id: string; name: string; slug: string; isActive: boolean }>(`/menu/lookup/${slug}`),

  // Restaurants (super-admin)
  getRestaurants: () => request<any>('/restaurants'),
  createRestaurant: (data: any) => request<any>('/restaurants', { method: 'POST', body: JSON.stringify(data) }),
  updateRestaurant: (id: string, data: any) => request<any>(`/restaurants/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteRestaurant: (id: string) => request<any>(`/restaurants/${id}`, { method: 'DELETE' }),
  customizeSettings: (data: { restaurantId?: string; name?: string; logoUrl?: string | null; themeColor?: string; menuTheme?: string }) =>
    request<any>('/restaurants/customize/settings', { method: 'PATCH', body: JSON.stringify(data) }),

  // Vendors (super-admin)
  getVendors: () => request<any>('/vendors'),
  getVendor: (id: string) => request<any>(`/vendors/${id}`),
  deleteVendor: (id: string) => request<any>(`/vendors/${id}`, { method: 'DELETE' }),
  resetVendorPassword: (id: string, newPassword: string) =>
    request<any>(`/vendors/${id}/reset-password`, { method: 'PATCH', body: JSON.stringify({ newPassword }) }),
  updateVendor: (id: string, data: any) =>
    request<any>(`/vendors/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),

  // Analytics
  getGlobalAnalytics: () => request<any>('/analytics/global'),
  getRestaurantAnalytics: (restaurantId: string) => request<any>(`/analytics/restaurant/${restaurantId}`),
  exportOrders: (restaurantId: string, from?: string, to?: string) => {
    const params = new URLSearchParams()
    if (restaurantId) params.set('restaurantId', restaurantId)
    if (from) params.set('from', from)
    if (to) params.set('to', to)
    const token = getToken()
    if (token) params.set('token', token)
    return `${BASE}/analytics/export/csv?${params}`
  },
  exportCustomers: (restaurantId?: string) => {
    const params = new URLSearchParams()
    if (restaurantId) params.set('restaurantId', restaurantId)
    const token = getToken()
    if (token) params.set('token', token)
    return `${BASE}/analytics/export/customers/csv?${params}`
  },
  exportRestaurants: () => {
    const params = new URLSearchParams()
    const token = getToken()
    if (token) params.set('token', token)
    return `${BASE}/analytics/export/restaurants/csv?${params}`
  },
  exportPlatformAnalytics: () => {
    const params = new URLSearchParams()
    const token = getToken()
    if (token) params.set('token', token)
    return `${BASE}/analytics/export/platform/csv?${params}`
  },

  // Categories
  getCategories: (rid: string) => request<any>(`/restaurants/${rid}/categories`),
  createCategory: (rid: string, data: any) => request<any>(`/restaurants/${rid}/categories`, { method: 'POST', body: JSON.stringify(data) }),
  updateCategory: (rid: string, id: string, data: any) => request<any>(`/restaurants/${rid}/categories/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteCategory: (rid: string, id: string) => request<any>(`/restaurants/${rid}/categories/${id}`, { method: 'DELETE' }),

  // Menu items
  getItems: (rid: string) => request<any>(`/restaurants/${rid}/items`),
  createItem: (rid: string, data: any) => request<any>(`/restaurants/${rid}/items`, { method: 'POST', body: JSON.stringify(data) }),
  updateItem: (rid: string, id: string, data: any) => request<any>(`/restaurants/${rid}/items/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteItem: (rid: string, id: string) => request<any>(`/restaurants/${rid}/items/${id}`, { method: 'DELETE' }),

  // Tables
  getTables: (rid: string) => request<any>(`/restaurants/${rid}/tables`),
  createSingleTable: (rid: string, tableNumber: number) =>
    request<any>(`/restaurants/${rid}/tables/single`, { method: 'POST', body: JSON.stringify({ tableNumber }) }),
  createTables: (rid: string, count: number) => request<any>(`/restaurants/${rid}/tables`, { method: 'POST', body: JSON.stringify({ count }) }),
  regenerateQr: (rid: string, id: string) => request<any>(`/restaurants/${rid}/tables/${id}/regenerate`, { method: 'POST' }),
  deleteTable: (rid: string, id: string) => request<any>(`/restaurants/${rid}/tables/${id}`, { method: 'DELETE' }),

  // Orders (vendor)
  getOrders: (rid: string, params?: Record<string, string>) => {
    const qs = params ? '?' + new URLSearchParams(params).toString() : ''
    return request<any>(`/orders/restaurant/${rid}${qs}`)
  },
  updateOrder: (rid: string, orderId: string, data: { status?: string; isPaid?: boolean }) =>
    request<any>(`/orders/restaurant/${rid}/${orderId}/status`, { method: 'PATCH', body: JSON.stringify(data) }),

  // Public
  getPublicMenu: (slug: string) => request<any>(`/menu/${slug}`),
  resolveQr: (slug: string, token: string) => request<any>(`/menu/${slug}/resolve?token=${token}`),
  placeOrder: (data: any) => request<any>(`/orders`, { method: 'POST', body: JSON.stringify(data) }),

  // Customers & Offers (Public)
  checkInCustomer: (slug: string, name: string, phone: string, consentMarketing = false) =>
    request<any>(`/menu/${slug}/customers`, { method: 'POST', body: JSON.stringify({ name, phone, consentMarketing }) }),
  lookupCustomer: (slug: string, phone: string) =>
    request<any>(`/menu/${slug}/customers/${phone}`),
  getActiveOffers: (slug: string) =>
    request<any>(`/menu/${slug}/offers`),
  getCustomerProfile: (slug: string, phone: string) =>
    request<any>(`/menu/${slug}/profile/${encodeURIComponent(phone)}`),
  claimReward: (slug: string, data: { phone: string; offerId: string }) =>
    request<any>(`/menu/${slug}/claims`, { method: 'POST', body: JSON.stringify(data) }),

  // Claims (Vendor)
  getClaims: (rid: string) =>
    request<any>(`/restaurants/${rid}/claims`),
  resolveClaim: (rid: string, claimId: string, status: 'APPROVED' | 'REJECTED') =>
    request<any>(`/restaurants/${rid}/claims/${claimId}`, { method: 'PATCH', body: JSON.stringify({ status }) }),

  // Customers & Offers (Vendor)
  getVendorCustomers: (rid: string, q?: string) =>
    request<any>(`/restaurants/${rid}/customers${q ? `?q=${encodeURIComponent(q)}` : ''}`),
  getVendorOffers: (rid: string) =>
    request<any>(`/restaurants/${rid}/customers/offers`),
  createVendorOffer: (rid: string, data: any) =>
    request<any>(`/restaurants/${rid}/customers/offers`, { method: 'POST', body: JSON.stringify(data) }),
  updateVendorOffer: (rid: string, id: string, data: any) =>
    request<any>(`/restaurants/${rid}/customers/offers/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteVendorOffer: (rid: string, id: string) =>
    request<any>(`/restaurants/${rid}/customers/offers/${id}`, { method: 'DELETE' }),
  adjustCustomerPoints: (rid: string, customerId: string, points: number) =>
    request<any>(`/restaurants/${rid}/customers/${customerId}/points`, { method: 'PATCH', body: JSON.stringify({ points }) }),

  // Loyalty Config (Vendor)
  getLoyaltyConfig: (rid: string) =>
    request<any>(`/restaurants/${rid}/customers/loyalty-config`),
  saveLoyaltyConfig: (rid: string, data: any) =>
    request<any>(`/restaurants/${rid}/customers/loyalty-config`, { method: 'PUT', body: JSON.stringify(data) }),

  // Marketing (Vendor)
  getSegments: (rid: string) =>
    request<any>(`/restaurants/${rid}/marketing/segments`),
  getCampaigns: (rid: string) =>
    request<any>(`/restaurants/${rid}/marketing/campaigns`),
  createCampaign: (rid: string, data: any) =>
    request<any>(`/restaurants/${rid}/marketing/campaigns`, { method: 'POST', body: JSON.stringify(data) }),
  sendCampaign: (rid: string, campaignId: string) =>
    request<any>(`/restaurants/${rid}/marketing/campaigns/${campaignId}/send`, { method: 'POST' }),
  deleteCampaign: (rid: string, campaignId: string) =>
    request<any>(`/restaurants/${rid}/marketing/campaigns/${campaignId}`, { method: 'DELETE' }),

  // Marketing (Admin)
  getMarketingStats: () => request<any>('/admin/marketing/stats'),
  getAdminAds: () => request<any>('/admin/marketing/ads'),
  createAdminAd: (data: any) => request<any>('/admin/marketing/ads', { method: 'POST', body: JSON.stringify(data) }),
  updateAdminAd: (id: string, data: any) => request<any>(`/admin/marketing/ads/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  getAdminPosters: () => request<any>('/admin/marketing/posters'),
  createAdminPoster: (data: any) => request<any>('/admin/marketing/posters', { method: 'POST', body: JSON.stringify(data) }),
  updateAdminPoster: (id: string, data: any) => request<any>(`/admin/marketing/posters/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  getAdminLeads: () => request<any>('/admin/marketing/leads'),
  createAdminLead: (data: any) => request<any>('/admin/marketing/leads', { method: 'POST', body: JSON.stringify(data) }),
  updateAdminLead: (id: string, data: any) => request<any>(`/admin/marketing/leads/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),

  // Staff Management (Vendor/Admin)
  getStaff: (rid: string) => request<any>(`/restaurants/${rid}/staff`),
  createStaff: (rid: string, data: any) => request<any>(`/restaurants/${rid}/staff`, { method: 'POST', body: JSON.stringify(data) }),
  updateStaff: (rid: string, id: string, data: any) => request<any>(`/restaurants/${rid}/staff/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteStaff: (rid: string, id: string) => request<any>(`/restaurants/${rid}/staff/${id}`, { method: 'DELETE' }),
}
