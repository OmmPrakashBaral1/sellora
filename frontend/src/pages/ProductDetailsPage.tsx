
import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router'
import { ArrowLeft, ExternalLink, ShoppingBag } from 'lucide-react'

import { getMarketplaceProductById } from '../api/products'
import type { PublicProduct } from '../types/product'

export default function ProductDetailsPage() {
  const { productId } = useParams<{ productId: string }>()

  const [product, setProduct] = useState<PublicProduct | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const controller = new AbortController()

    async function loadProduct() {
      setLoading(true)
      setError(null)
      setProduct(null)

      const id = Number(productId)

      if (!productId || !Number.isSafeInteger(id) || id <= 0) {
        setError('Invalid product ID.')
        setLoading(false)
        return
      }

      try {
        const data = await getMarketplaceProductById(
          id,
          controller.signal
        )

        if (!controller.signal.aborted) {
          setProduct(data)
        }
      } catch (err) {
        if (!controller.signal.aborted) {
          setError(
            err instanceof Error
              ? err.message
              : 'Unable to load product.'
          )
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false)
        }
      }
    }

    void loadProduct()

    return () => controller.abort()
  }, [productId])

  if (loading) {
    return (
      <main className="mx-auto max-w-7xl px-6 py-20">
        <p className="text-muted" role="status">
          Loading product details...
        </p>
      </main>
    )
  }

  if (error || !product) {
    return (
      <main className="mx-auto max-w-7xl px-6 py-20">
        <h1 className="text-3xl font-bold">
          {error ? 'Unable to load product' : 'Product not found'}
        </h1>

        <p className="mt-4 text-muted">
          {error ?? 'This product is unavailable or does not exist.'}
        </p>

        <Link
          to="/products"
          className="mt-6 inline-flex items-center gap-2 font-semibold text-brand"
        >
          <ArrowLeft size={18} />
          Back to marketplace
        </Link>
      </main>
    )
  }

  const formattedPrice = new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
  }).format(Number(product.price))

  return (
    <main className="min-h-screen bg-page text-foreground">
      <div className="mx-auto max-w-7xl px-6 py-10">
        <Link
          to="/products"
          className="inline-flex items-center gap-2 text-sm font-medium text-muted transition hover:text-brand"
        >
          <ArrowLeft size={18} />
          Back to marketplace
        </Link>

        <div className="mt-10 grid gap-12 lg:grid-cols-2">
          {/* Product preview */}
          <section>
            <div className="overflow-hidden rounded-2xl border border-outline bg-surface">
              <img
                src={product.thumbnail_url}
                alt={product.title}
                className="aspect-video w-full object-cover"
              />
            </div>
          </section>

          {/* Product information */}
          <section>
            <p className="text-sm font-semibold uppercase tracking-widest text-brand">
              Digital Product
            </p>

            <h1 className="mt-4 text-4xl font-extrabold leading-tight md:text-5xl">
              {product.title}
            </h1>

            <p className="mt-5 text-3xl font-bold text-brand">
              {formattedPrice}
            </p>

            <div className="mt-6 flex flex-wrap gap-2">
              {product.tags.map((tag) => (
                <span
                  key={tag}
                  className="rounded-full border border-outline bg-surface px-3 py-1 text-sm text-muted"
                >
                  {tag}
                </span>
              ))}
            </div>

            <div className="mt-8 border-t border-outline pt-7">
              <h2 className="text-xl font-bold">
                About this product
              </h2>

              <p className="mt-4 whitespace-pre-line leading-8 text-muted">
                {product.description}
              </p>
            </div>

            <div className="mt-9 flex flex-wrap gap-4">
              <button
                type="button"
                disabled
                title="Checkout integration coming soon"
                className="inline-flex items-center gap-2 rounded-lg bg-brand px-7 py-3 font-semibold text-brand-foreground opacity-60"
              >
                <ShoppingBag size={19} />
                Buy Now
              </button>

              {product.demo_url && (
                <a
                  href={product.demo_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 rounded-lg border border-outline bg-surface px-7 py-3 font-semibold transition hover:bg-page"
                >
                  <ExternalLink size={18} />
                  View Demo
                </a>
              )}
            </div>

            <p className="mt-4 text-sm text-muted">
              Secure checkout will be available after buyer
              authentication and payment integration.
            </p>
          </section>
        </div>
      </div>
    </main>
  )
}