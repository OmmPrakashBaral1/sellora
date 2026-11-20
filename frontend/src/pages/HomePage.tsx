
import { useEffect, useState } from 'react'
import { ArrowRight, ArrowUpRight } from 'lucide-react'
import { Link } from 'react-router'

import { getMarketplaceProducts } from '../api/products'
import ProductCard from '../components/ProductCard'
import type { PublicProduct } from '../types/product'

const PREVIEW_LIMIT = 6

export default function HomePage() {
  const [products, setProducts] = useState<PublicProduct[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const controller = new AbortController()

    async function loadProducts() {
      try {
        const data = await getMarketplaceProducts(controller.signal)

        if (!controller.signal.aborted) {
          setProducts(data.slice(0, PREVIEW_LIMIT))
        }
      } catch (err) {
        if (!controller.signal.aborted) {
          setError(
            err instanceof Error
              ? err.message
              : 'Unable to load products.'
          )
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false)
        }
      }
    }

    void loadProducts()

    return () => controller.abort()
  }, [])

  return (
    <main className="min-h-screen bg-page text-foreground">
      {/* EDITORIAL INTRODUCTION */}
      <section className="border-b border-outline">
        <div className="mx-auto max-w-7xl px-6 pb-14 pt-16 sm:pb-20 sm:pt-24">
          <div className="mb-8 flex items-center gap-3">
            <span className="h-px w-8 bg-brand" />
            <p className="text-xs font-bold uppercase tracking-[0.22em] text-brand">
              Independent digital marketplace
            </p>
          </div>

          <div className="grid gap-10 lg:grid-cols-[1.5fr_0.5fr] lg:items-end">
            <div>
              <h1 className="max-w-4xl text-5xl font-bold leading-[1.04] tracking-[-0.045em] sm:text-6xl lg:text-[5.5rem]">
                Digital goods for
                <span className="block text-brand">
                  people who make things.
                </span>
              </h1>
            </div>

            <div className="lg:pb-2">
              <p className="max-w-sm text-base leading-7 text-muted">
                Explore templates, design resources, code,
                and practical digital tools from independent
                creators.
              </p>

              <Link
                to="/products"
                className="mt-7 inline-flex items-center gap-2 border-b border-brand pb-2 text-sm font-semibold text-brand transition hover:gap-3 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand"
              >
                Explore the marketplace
                <ArrowUpRight className="h-4 w-4" />
              </Link>
            </div>
          </div>

          <div className="mt-14 flex items-center justify-between border-t border-outline pt-5 text-xs font-medium uppercase tracking-[0.16em] text-muted">
            <span>Discover / Create / Build</span>
            <span>Scroll to explore</span>
          </div>
        </div>
      </section>

      {/* PRODUCT DISCOVERY */}
      <section
        className="mx-auto max-w-7xl px-6 py-16 sm:py-20"
        aria-labelledby="discover-heading"
      >
        <div className="mb-10 flex flex-wrap items-end justify-between gap-6">
          <div>
            <p className="mb-3 text-xs font-bold uppercase tracking-[0.2em] text-brand">
              The marketplace
            </p>

            <h2
              id="discover-heading"
              className="text-3xl font-bold tracking-tight sm:text-4xl"
            >
              Discover digital products.
            </h2>

            <p className="mt-3 max-w-xl text-muted">
              A selection of currently available products.
            </p>
          </div>

          <Link
            to="/products"
            className="inline-flex items-center gap-2 text-sm font-semibold text-brand transition hover:gap-3"
          >
            View all products
            <ArrowUpRight className="h-4 w-4" />
          </Link>
        </div>

        {loading && (
          <div
            className="grid gap-7 sm:grid-cols-2 lg:grid-cols-3"
            role="status"
            aria-label="Loading products"
          >
            {Array.from({ length: PREVIEW_LIMIT }).map((_, index) => (
              <div key={index} className="animate-pulse">
                <div className="aspect-[4/3] rounded-2xl bg-accent" />
                <div className="mt-4 h-5 w-3/4 rounded bg-accent" />
                <div className="mt-3 h-4 w-1/2 rounded bg-accent" />
              </div>
            ))}
            <span className="sr-only">Loading products...</span>
          </div>
        )}

        {!loading && error && (
          <div
            role="alert"
            className="border-y border-outline py-12"
          >
            <h3 className="text-xl font-semibold">
              Products are temporarily unavailable.
            </h3>
            <p className="mt-2 text-sm text-muted">
              Please try again later or visit the marketplace.
            </p>
            <Link
              to="/products"
              className="mt-5 inline-flex items-center gap-2 font-semibold text-brand"
            >
              Open marketplace
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        )}

        {!loading && !error && products.length === 0 && (
          <div className="border-y border-outline py-16">
            <h3 className="text-2xl font-semibold">
              Our collection is taking shape.
            </h3>
            <p className="mt-3 max-w-lg text-muted">
              No approved products are available yet.
              Check back as new digital resources are added.
            </p>
          </div>
        )}

        {!loading && !error && products.length > 0 && (
          <div className="grid gap-x-6 gap-y-12 sm:grid-cols-2 lg:grid-cols-3">
            {products.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        )}
      </section>

      {/* SELLORA PURPOSE */}
      <section className="border-t border-outline bg-surface">
        <div className="mx-auto grid max-w-7xl gap-8 px-6 py-16 md:grid-cols-[0.7fr_1.3fr] md:py-20">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-brand">
              Why Sellora
            </p>
          </div>

          <div>
            <h2 className="max-w-3xl text-3xl font-semibold leading-tight tracking-tight sm:text-4xl">
              Useful digital products deserve a place
              where people can discover them.
            </h2>

            <p className="mt-6 max-w-2xl leading-7 text-muted">
              Sellora is being built to connect independent
              creators with people looking for practical
              digital resources. Our focus is straightforward:
              make products easier to explore, evaluate,
              and eventually purchase securely.
            </p>

            <Link
              to="/products"
              className="mt-8 inline-flex items-center gap-2 font-semibold text-brand"
            >
              Browse available products
              <ArrowUpRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>
    </main>
  )
}
