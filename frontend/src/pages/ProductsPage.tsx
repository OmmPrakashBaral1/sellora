
import { useEffect, useState } from 'react'
import {
  ArrowLeft,
  ArrowRight,
  ChevronDown,
  Compass,
  RotateCcw,
  Search,
} from 'lucide-react'
import { Link } from 'react-router'

import { getMarketplaceProducts } from '../api/products'
import ProductCard from '../components/ProductCard'
import type { PublicProduct } from '../types/product'

type SortOption = 'newest' | 'price_asc' | 'price_desc'


export default function ProductsPage() {
  const [products, setProducts] = useState<PublicProduct[]>([])
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [sortBy, setSortBy] = useState<SortOption>('newest')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [retryKey, setRetryKey] = useState(0)
  const [page, setPage] = useState(1)
  const [hasNextPage, setHasNextPage] = useState(false)

  const PAGE_SIZE = 12

  const filtersActive = search !== '' || sortBy !== 'newest'

  useEffect(() => {
    const controller = new AbortController()

    async function loadProducts() {
      try {
        const data = await getMarketplaceProducts(
          controller.signal,
          {
            search,
            sortBy,
            skip: (page - 1) * PAGE_SIZE,
            limit: PAGE_SIZE + 1,
          }
        )

        if (!controller.signal.aborted) {
          setProducts(data.slice(0, PAGE_SIZE))
          setHasNextPage(data.length > PAGE_SIZE)
          setError(null)
        }
      } catch (err) {
        if (!controller.signal.aborted) {
          setProducts([])
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

    return () => {
      controller.abort()
    }
  }, [search, sortBy, page, retryKey])

  function handleSearch(event: React.SubmitEvent<HTMLFormElement>) {
    event.preventDefault()

    const normalized = searchInput.trim()

    if (normalized.length > 100 || normalized === search) {
      return
    }

    setLoading(true)
    setError(null)
    setPage(1)
    setSearch(normalized)
  }

  function handleSortChange(value: SortOption) {
    if (value === sortBy) {
      return
    }

    setLoading(true)
    setError(null)
    setPage(1)
    setSortBy(value)
  }

  function handleReset() {
    setSearchInput('')

    if (!filtersActive) {
      return
    }

    setLoading(true)
    setError(null)
    setPage(1)
    setSearch('')
    setSortBy('newest')
  }

  function handleRetry() {
    setLoading(true)
    setError(null)
    setRetryKey((previous) => previous + 1)
  }

  return (
    <main className="min-h-screen bg-page text-foreground">
      <div className="mx-auto max-w-7xl px-6 py-12 lg:py-16">

        {/* PAGE INTRODUCTION */}
        <header className="mb-10 border-b border-outline pb-10">
          <Link
            to="/"
            className="
              mb-8 inline-flex items-center gap-2
              text-sm font-medium text-muted
              transition-colors hover:text-brand
              focus-visible:rounded-sm
              focus-visible:outline-2
              focus-visible:outline-offset-4
              focus-visible:outline-brand
            "
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Home
          </Link>

          <div className="mb-4 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] text-brand">
            <Compass className="h-4 w-4" />
            The Marketplace
          </div>

          <h1 className="max-w-4xl text-4xl font-bold tracking-tight sm:text-5xl">
            Find what you're looking for.
          </h1>

          <p className="mt-4 max-w-2xl leading-7 text-muted">
            Search digital products, discover independent
            creators, and find resources for your next project.
          </p>
        </header>

        {/* SEARCH AND SORT TOOLBAR */}
        <section
          aria-label="Product search and sorting"
          className="mb-10"
        >
          <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_260px] lg:items-end">

            {/* SEARCH */}
            <form
              onSubmit={handleSearch}
              role="search"
              className="min-w-0"
            >
              <label
                htmlFor="marketplace-search"
                className="mb-2 block text-sm font-semibold text-foreground"
              >
                Search products
              </label>

              <div className="flex gap-2">
                <div className="relative min-w-0 flex-1">
                  <Search
                    aria-hidden="true"
                    className="
                      pointer-events-none absolute
                      left-4 top-1/2 h-5 w-5
                      -translate-y-1/2 text-muted
                    "
                  />

                  <input
                    id="marketplace-search"
                    type="search"
                    value={searchInput}
                    onChange={(event) =>
                      setSearchInput(event.target.value)
                    }
                    maxLength={100}
                    placeholder="Search templates, ebooks, code..."
                    className="
                      h-12 w-full rounded-xl
                      border border-outline bg-surface
                      pl-12 pr-4 text-sm text-foreground
                      outline-none transition-colors
                      placeholder:text-muted
                      hover:border-brand/40
                      focus-visible:border-brand
                      focus-visible:ring-2
                      focus-visible:ring-brand/20
                    "
                  />
                </div>

                <button
                  type="submit"
                  className="
                    inline-flex h-12 shrink-0
                    items-center justify-center gap-2
                    rounded-xl bg-brand px-5
                    text-sm font-semibold
                    text-brand-foreground
                    transition-opacity hover:opacity-90
                    focus-visible:outline-2
                    focus-visible:outline-offset-2
                    focus-visible:outline-brand
                    sm:px-6
                  "
                >
                  <span>Search</span>
                  <ArrowRight
                    aria-hidden="true"
                    className="hidden h-4 w-4 sm:block"
                  />
                </button>
              </div>
            </form>

            {/* SORTING */}
            <div className="min-w-0">
              <label
                htmlFor="marketplace-sort"
                className="mb-2 block text-sm font-semibold text-foreground"
              >
                Sort by
              </label>

              <div className="group relative">
                <select
                  id="marketplace-sort"
                  value={sortBy}
                  onChange={(event) =>
                    handleSortChange(
                      event.target.value as SortOption
                    )
                  }
                  className="
                    h-12 w-full cursor-pointer
                    appearance-none rounded-xl
                    border border-outline bg-surface
                    pl-4 pr-12
                    text-sm font-medium text-foreground
                    outline-none transition-colors
                    hover:border-brand/50
                    focus-visible:border-brand
                    focus-visible:ring-2
                    focus-visible:ring-brand/20
                  "
                >
                  <option value="newest">
                    Newest first
                  </option>
                  <option value="price_asc">
                    Price: low to high
                  </option>
                  <option value="price_desc">
                    Price: high to low
                  </option>
                </select>

                <ChevronDown
                  aria-hidden="true"
                  className="
                    pointer-events-none absolute
                    right-4 top-1/2 h-4 w-4
                    -translate-y-1/2 text-muted
                    transition-colors
                    group-hover:text-brand
                  "
                />
              </div>
            </div>
          </div>

          {/* ACTIVE FILTERS */}
          {filtersActive && (
            <div className="mt-5 flex flex-wrap items-center gap-3">
              {search && (
                <span className="inline-flex max-w-full items-center rounded-full border border-outline bg-surface px-3 py-1.5 text-xs font-medium text-foreground">
                  <span className="truncate">
                    Search: {search}
                  </span>
                </span>
              )}

              <button
                type="button"
                onClick={handleReset}
                className="
                  inline-flex items-center gap-2
                  text-sm font-semibold text-brand
                  transition-opacity hover:opacity-75
                  focus-visible:rounded-sm
                  focus-visible:outline-2
                  focus-visible:outline-offset-4
                  focus-visible:outline-brand
                "
              >
                <RotateCcw
                  aria-hidden="true"
                  className="h-4 w-4"
                />
                Reset filters
              </button>
            </div>
          )}
        </section>

        {/* LOADING */}
        {loading && (
          <div
            role="status"
            aria-label="Loading products"
            className="grid gap-7 sm:grid-cols-2 lg:grid-cols-3"
          >
            {Array.from({ length: 6 }).map((_, index) => (
              <div
                key={index}
                className="animate-pulse motion-reduce:animate-none"
              >
                <div className="aspect-[4/3] rounded-2xl bg-accent" />
                <div className="mt-4 h-5 w-3/4 rounded bg-accent" />
                <div className="mt-3 h-4 w-1/2 rounded bg-accent" />
              </div>
            ))}

            <span className="sr-only">
              Loading marketplace products...
            </span>
          </div>
        )}

        {/* ERROR */}
        {!loading && error && (
          <div
            role="alert"
            className="rounded-2xl border border-outline bg-surface p-8 sm:p-10"
          >
            <h2 className="text-xl font-semibold">
              We couldn't load the marketplace.
            </h2>

            <p className="mt-3 max-w-lg text-sm leading-6 text-muted">
              Something went wrong while retrieving products.
              Please try again.
            </p>

            <button
              type="button"
              onClick={handleRetry}
              className="
                mt-6 inline-flex items-center gap-2
                rounded-xl bg-brand px-5 py-3
                text-sm font-semibold text-brand-foreground
                transition-opacity hover:opacity-90
              "
            >
              <RotateCcw className="h-4 w-4" />
              Try again
            </button>
          </div>
        )}

        {/* EMPTY RESULTS */}
        {!loading && !error && products.length === 0 && (
          <div className="border-y border-outline py-16 text-center">
            <Search
              aria-hidden="true"
              className="mx-auto mb-5 h-9 w-9 text-brand"
            />

            <h2 className="text-2xl font-semibold tracking-tight">
              {search
                ? 'No matching products found.'
                : 'No products available yet.'}
            </h2>

            <p className="mx-auto mt-3 max-w-md leading-7 text-muted">
              {search
                ? 'Try a different search term or clear your filters.'
                : 'There are currently no approved digital products to explore.'}
            </p>

            {filtersActive && (
              <button
                type="button"
                onClick={handleReset}
                className="
                  mt-6 inline-flex items-center gap-2
                  font-semibold text-brand
                  hover:opacity-75
                "
              >
                <RotateCcw className="h-4 w-4" />
                Clear filters
              </button>
            )}
          </div>
        )}

        {/* PRODUCT RESULTS */}
        {!loading && !error && products.length > 0 && (
          <section aria-label="Marketplace products">
            <div className="mb-7 flex flex-wrap items-center justify-between gap-3">
              <p
                className="text-sm text-muted"
                aria-live="polite"
              >

                <p
                  className="text-sm text-muted"
                  aria-live="polite"
                >
                  Showing {(page - 1) * PAGE_SIZE + 1}–
                  {(page - 1) * PAGE_SIZE + products.length} products
                </p>

              </p>
            </div>

            <div className="grid gap-x-6 gap-y-12 sm:grid-cols-2 lg:grid-cols-3">
              {products.map((product) => (
                <ProductCard
                  key={product.id}
                  product={product}
                />
              ))}
            </div>
            {/* PAGINATION CONTROLS - NEW CODE STARTS HERE */}
            <div className="mt-14 flex items-center justify-between gap-3 border-t border-outline pt-6">
              <button
                type="button"
                disabled={page === 1 || loading}
                onClick={() => {
                  setLoading(true)
                  setError(null)
                  setPage((previous) => Math.max(1, previous - 1))
                }}
                className="inline-flex items-center gap-2 rounded-xl border border-outline bg-surface px-5 py-3 text-sm font-semibold text-foreground transition-colors hover:border-brand/50 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <ArrowLeft className="h-4 w-4" />
                Previous
              </button>

              <span className="text-sm font-medium text-muted">
                Page {page}
              </span>

              <button
                type="button"
                disabled={!hasNextPage || loading}
                onClick={() => {
                  setLoading(true)
                  setError(null)
                  setPage((previous) => previous + 1)
                }}
                className="inline-flex items-center gap-2 rounded-xl bg-brand px-5 py-3 text-sm font-semibold text-brand-foreground transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Next
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
            {/* PAGINATION CONTROLS - NEW CODE ENDS HERE */}

          </section>
        )}
      </div>
    </main>
  )
}
