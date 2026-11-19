
import { useEffect, useState } from 'react'
import { ArrowLeft, Compass } from 'lucide-react'
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
    <main className="min-h-screen bg-page text-foreground">
      <div className="mx-auto max-w-7xl px-6 py-12 lg:py-16">

        {/* PAGE HEADER */}
        <div className="mb-12 border-b border-outline pb-10">
          <Link
            to="/"
            className="mb-8 inline-flex items-center gap-2 text-sm font-medium text-muted transition hover:text-brand"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Home
          </Link>

          <div className="flex flex-wrap items-end justify-between gap-6">
            <div>
              <div className="mb-4 flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.18em] text-brand">
                <Compass className="h-4 w-4" />
                The Marketplace
              </div>

              <h1 className="text-4xl font-extrabold tracking-tight sm:text-5xl">
                Explore digital products.
              </h1>

              <p className="mt-4 max-w-2xl text-base leading-relaxed text-muted">
                Discover templates, design assets, code,
                ebooks, and creative resources from
                independent creators.
              </p>
            </div>

            {!loading && !error && (
              <p className="text-sm font-medium text-muted">
                {products.length}{' '}
                {products.length === 1 ? 'product' : 'products'}
              </p>
            )}
          </div>
        </div>

        {/* LOADING STATE */}
        {loading && (
          <div
            className="grid gap-7 sm:grid-cols-2 lg:grid-cols-3"
            role="status"
            aria-label="Loading products"
          >
            {Array.from({ length: 6 }).map((_, index) => (
              <div key={index} className="animate-pulse">
                <div className="aspect-[4/3] rounded-2xl bg-accent" />
                <div className="mt-4 h-5 w-3/4 rounded bg-accent" />
                <div className="mt-3 h-4 w-1/2 rounded bg-accent" />
              </div>
            ))}
            <span className="sr-only">Loading products...</span>
          </div>
        )}

        {/* ERROR STATE */}
        {!loading && error && (
          <div
            role="alert"
            className="rounded-2xl border border-outline bg-surface p-8"
          >
            <h2 className="text-lg font-bold">
              We couldn't load the marketplace.
            </h2>

            <p className="mt-2 text-sm text-muted">
              {error}
            </p>
          </div>
        )}

        {/* EMPTY STATE */}
        {!loading && !error && products.length === 0 && (
          <div className="rounded-2xl border border-outline bg-surface px-6 py-20 text-center">
            <Compass className="mx-auto mb-5 h-10 w-10 text-brand" />

            <h2 className="text-2xl font-bold">
              Something creative is coming.
            </h2>

            <p className="mx-auto mt-3 max-w-md text-muted">
              There are no approved digital products
              available right now. Check back later.
            </p>
          </div>
        )}

        {/* PRODUCT GRID */}
        {!loading && !error && products.length > 0 && (
          <section aria-label="Marketplace products">
            <div className="grid gap-x-6 gap-y-12 sm:grid-cols-2 lg:grid-cols-3">
              {products.map((product) => (
                <ProductCard
                  key={product.id}
                  product={product}
                />
              ))}
            </div>
          </section>
        )}
      </div>
    </main>
  )
}
