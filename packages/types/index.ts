// Shared TypeScript types used by both apps/api and apps/web

export type UserRole = 'SUPER_ADMIN' | 'RESTAURANT_ADMIN'

export type OrderStatus = 'PENDING' | 'PREPARING' | 'SERVED' | 'CANCELLED'

export interface User {
  id: string
  email: string
  role: UserRole
  restaurantId: string | null
  createdAt: string
  updatedAt: string
}

export interface Restaurant {
  id: string
  name: string
  slug: string
  logoUrl: string | null
  address: string | null
  phone: string | null
  isActive: boolean
  createdAt: string
}

export interface MenuCategory {
  id: string
  restaurantId: string
  name: string
  sortOrder: number
  isActive: boolean
  items?: MenuItem[]
}

export interface MenuItem {
  id: string
  restaurantId: string
  categoryId: string
  name: string
  description: string | null
  price: string // Decimal serialized as string
  imageUrl: string | null
  isAvailable: boolean
  sortOrder: number
}

export interface Table {
  id: string
  restaurantId: string
  tableNumber: number
  qrToken: string
  qrImageUrl: string | null
  isActive: boolean
  tokenUpdatedAt: string
}

export interface OrderItem {
  id: string
  orderId: string
  menuItemId: string
  nameSnapshot: string
  priceSnapshot: string
  quantity: number
  subtotal: string
}

export interface Order {
  id: string
  restaurantId: string
  tableId: string
  tableNumber: number
  status: OrderStatus
  customerNote: string | null
  totalAmount: string
  placedAt: string
  updatedAt: string
  items: OrderItem[]
}

export interface AuthPayload {
  userId: string
  role: UserRole
  restaurantId: string | null
}

// API response shapes
export interface LoginResponse {
  accessToken: string
  user: Pick<User, 'id' | 'email' | 'role' | 'restaurantId'>
}

export interface MenuPublicResponse {
  restaurant: Restaurant
  categories: (MenuCategory & { items: MenuItem[] })[]
}

export interface TableResolveResponse {
  tableId: string
  tableNumber: number
  restaurantId: string
}

// Cart item (frontend only)
export interface CartItem {
  menuItemId: string
  name: string
  price: number
  quantity: number
}
