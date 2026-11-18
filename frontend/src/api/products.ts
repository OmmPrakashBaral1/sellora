import { API_BASE_URL } from './client'
import type { PublicProduct } from '../types/product'

export async function getMarketplaceProducts(): Promise<PublicProduct[]> {
  const response = await fetch(
    `${API_BASE_URL}/products/marketplace`
  )

  if (!response.ok) {
    throw new Error(`Failed to load products: HTTP ${response.status}`)
  }

  const data: unknown = await response.json()

  if (!Array.isArray(data)) {
    throw new Error('Invalid marketplace response')
  }

  return data as PublicProduct[]
}