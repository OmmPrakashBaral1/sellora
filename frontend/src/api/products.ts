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
