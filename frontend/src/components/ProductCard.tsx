import { Link } from 'react-router'
import type { PublicProduct } from '../types/product'

interface ProductCardProps {
  product: PublicProduct
}

export default function ProductCard({ product }: ProductCardProps) {
  const price = Number(product.price)

  return (
    <article className="overflow-hidden rounded-xl border border-slate-800 bg-slate-900 transition hover:border-indigo-500">
      <Link to={`/products/${product.id}`}>
        <div className="aspect-video overflow-hidden bg-slate-800">
          <img
            src={product.thumbnail_url}
            alt={product.title}
            loading="lazy"
            className="h-full w-full object-cover transition duration-300 hover:scale-105"
          />
        </div>
      </Link>

      <div className="p-5">
        <div className="mb-3 flex flex-wrap gap-2">
          {product.tags.slice(0, 3).map((tag) => (
            <span
              key={tag}
              className="rounded-full bg-indigo-500/10 px-3 py-1 text-xs text-indigo-300"
            >
              {tag}
            </span>
          ))}
        </div>

        <Link to={`/products/${product.id}`}>
          <h2 className="text-lg font-semibold text-white hover:text-indigo-400">
            {product.title}
          </h2>
        </Link>

        <p className="mt-2 line-clamp-2 text-sm text-slate-400">
          {product.description}
        </p>

        <div className="mt-5 flex items-center justify-between">
          <span className="text-xl font-bold text-white">
            {Number.isFinite(price)
              ? new Intl.NumberFormat('en-IN', {
                  style: 'currency',
                  currency: 'INR',
                }).format(price)
              : 'Price unavailable'}
          </span>

          <Link
            to={`/products/${product.id}`}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500"
          >
            View Details
          </Link>
        </div>
      </div>
    </article>
  )
}