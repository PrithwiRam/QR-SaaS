'use client'
import { createContext, useContext } from 'react'

export interface VendorCtx {
  restaurantId: string
  restaurantName: string
  slug: string
}

export const VendorContext = createContext<VendorCtx | null>(null)
export function useVendorCtx() { return useContext(VendorContext) }
