import { useEffect, useState } from 'react'
import { Link } from 'react-router'

import { getMarketplaceProducts } from '../api/products'
import ProductCard from '../components/ProductCard'
import type { PublicProduct } from '../types/product'

export default function ProductsPage() {
  const [products, setProducts] = useState<PublicProduct[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true

    async function loadProducts() {
      try {
        const data = await getMarketplaceProducts()

        if (active) {
          setProducts(data)
        }
      } catch (err) {
        if (active) {
          setError(
            err instanceof Error
              ? err.message
              : 'Unable to load products'
          )
        }
      } finally {
        if (active) {
          setLoading(false)
        }
      }
    }

    void loadProducts()

    return () => {
      active = false
    }
  }, [])

  return (
    <main className="min-h-screen bg-slate-950 px-6 py-12 text-white">
      <div className="mx-auto max-w-7xl">
        <div className="mb-10 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-4xl font-bold">Explore Digital Products</h1>
            <p className="mt-3 text-slate-400">
              Discover digital products from independent creators.
            </p>
          </div>

          <Link to="/" className="text-indigo-400 hover:text-indigo-300">
            Back to Home
          </Link>
        </div>

        {loading && (
          <p className="text-slate-300">Loading products...</p>
        )}

        {error && (
          <p role="alert" className="text-red-400">
            {error}
          </p>
        )}

        {!loading && !error && products.length === 0 && (
          <p className="text-slate-400">
            No approved products available yet.
          </p>
        )}

        {!loading && !error && products.length > 0 && (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {products.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        )}
      </div>
    </main>
  )
}