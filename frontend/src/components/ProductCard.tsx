
import { ArrowUpRight } from 'lucide-react'
import { Link } from 'react-router'

import ProductThumbnail from './ProductThumbnail'
import type { PublicProduct } from '../types/product'

interface ProductCardProps {
  product: PublicProduct
}

export default function ProductCard({
  product,
}: ProductCardProps) {
  const price = Number(product.price)

  const formattedPrice =
    product.price.trim() !== '' &&
    Number.isFinite(price) &&
    price >= 0
      ? new Intl.NumberFormat('en-IN', {
          style: 'currency',
          currency: 'INR',
          maximumFractionDigits: 2,
        }).format(price)
      : 'Price unavailable'

  return (
    <article className="group min-w-0">
      <Link
        to={`/products/${product.id}`}
        aria-label={`View ${product.title}`}
        className="block rounded-2xl focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand"
      >
        <div className="relative aspect-[4/3] overflow-hidden rounded-2xl border border-outline bg-accent">
          <ProductThumbnail
            src={product.thumbnail_url}
            alt={product.title}
            className="h-full w-full transition-transform duration-500 group-hover:scale-[1.04] motion-reduce:transform-none"
          />

          <div
            className="absolute bottom-3 right-3 flex h-10 w-10 items-center justify-center rounded-full bg-surface text-foreground shadow-sm transition-colors duration-200 group-hover:bg-brand group-hover:text-brand-foreground"
            aria-hidden="true"
          >
            <ArrowUpRight className="h-5 w-5" />
          </div>
        </div>

        <div className="px-1 pt-4">
          {product.tags.length > 0 && (
            <p className="mb-2 truncate text-xs font-semibold uppercase tracking-[0.12em] text-brand">
              {product.tags.slice(0, 2).join(' / ')}
            </p>
          )}

          <div className="flex items-start justify-between gap-3">
            <h3 className="min-w-0 flex-1 text-lg font-bold leading-snug tracking-tight text-foreground transition-colors group-hover:text-brand">
              {product.title}
            </h3>

            <span className="shrink-0 text-base font-bold text-foreground">
              {formattedPrice}
            </span>
          </div>

          <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-muted">
            {product.description}
          </p>
        </div>
      </Link>
    </article>
  )
}
