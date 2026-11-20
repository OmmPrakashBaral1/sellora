
import { API_BASE_URL } from './client'
import type { PublicProduct } from '../types/product'

export interface MarketplaceProductFilters {
  search?: string
  tag?: string
  minPrice?: number
  maxPrice?: number
  sortBy?: 'newest' | 'price_asc' | 'price_desc'
  skip?: number
  limit?: number
}

export async function getMarketplaceProducts(
  signal?: AbortSignal,
  filters: MarketplaceProductFilters = {}
): Promise<PublicProduct[]> {
  const params = new URLSearchParams()

  const search = filters.search?.trim()
  const tag = filters.tag?.trim()

  if (search) {
    params.set('search', search)
  }

  if (tag) {
    params.set('tag', tag)
  }

  if (filters.minPrice !== undefined) {
    params.set('min_price', String(filters.minPrice))
  }

  if (filters.maxPrice !== undefined) {
    params.set('max_price', String(filters.maxPrice))
  }

  if (filters.sortBy) {
    params.set('sort_by', filters.sortBy)
  }

  if (filters.skip !== undefined) {
    params.set('skip', String(filters.skip))
  }

  if (filters.limit !== undefined) {
    params.set('limit', String(filters.limit))
  }

  const query = params.toString()

  const url = `${API_BASE_URL}/products/marketplace${
    query ? `?${query}` : ''
  }`

  const response = await fetch(url, { signal })

  if (!response.ok) {
    throw new Error(
      `Failed to load products: HTTP ${response.status}`
    )
  }

  const data: unknown = await response.json()

  if (!Array.isArray(data)) {
    throw new Error('Invalid marketplace response')
  }

  return data as PublicProduct[]
}

export async function getMarketplaceProductById(
  productId: number,
  signal?: AbortSignal
): Promise<PublicProduct | null> {
  if (!Number.isSafeInteger(productId) || productId <= 0) {
    throw new Error('Invalid product ID')
  }

  const response = await fetch(
    `${API_BASE_URL}/products/marketplace/${productId}`,
    { signal }
  )

  if (response.status === 404) {
    return null
  }

  if (!response.ok) {
    throw new Error(
      `Failed to load product: HTTP ${response.status}`
    )
  }

  const data: unknown = await response.json()

  if (
    typeof data !== 'object' ||
    data === null ||
    Array.isArray(data) ||
    !('id' in data) ||
    data.id !== productId
  ) {
    throw new Error('Invalid product response')
  }

  return data as unknown as PublicProduct
}
