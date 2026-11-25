import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { ShoppingBag } from 'lucide-react'

import { getMyOrders } from '../api/orders'
import { useAuth } from '../context/useAuth'
import type { BuyerOrder } from '../types/order'

type OrderFilter =
  | 'ALL'
  | 'PENDING'
  | 'COMPLETED'
  | 'CANCELLED'

const filters: OrderFilter[] = [
  'ALL',
  'COMPLETED',
  'PENDING',
  'CANCELLED',
]

const currencyFormatter = new Intl.NumberFormat(
  'en-IN',
  {
    style: 'currency',
    currency: 'INR',
  },
)

function formatPrice(amount: string) {
  return currencyFormatter.format(Number(amount))
}

function formatDate(value: string | null) {
  if (!value) return 'Date unavailable'

  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return 'Date unavailable'
  }

  return date.toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

function getStatusClass(status: string) {
  switch (status) {
    case 'COMPLETED':
      return 'bg-green-500/10 text-green-600'

    case 'PENDING':
      return 'bg-amber-500/10 text-amber-600'

    case 'CANCELLED':
      return 'bg-red-500/10 text-red-500'

    default:
      return 'bg-page text-muted'
  }
}

export default function OrdersPage() {
  const { getAccessToken } = useAuth()

  const [orders, setOrders] =
    useState<BuyerOrder[]>([])

  const [loading, setLoading] = useState(true)

  const [error, setError] =
    useState<string | null>(null)

  const [filter, setFilter] =
    useState<OrderFilter>('ALL')

  const [retryCount, setRetryCount] = useState(0)

  useEffect(() => {
    const controller = new AbortController()

    async function loadOrders() {
      setLoading(true)
      setError(null)

      try {
        const token = await getAccessToken()

        if (controller.signal.aborted) return

        if (!token) {
          throw new Error(
            'Unable to authenticate your session.',
          )
        }

        const data = await getMyOrders(
          token,
          controller.signal,
        )

        if (!controller.signal.aborted) {
          setOrders(data)
        }
      } catch (err) {
        if (!controller.signal.aborted) {
          setError(
            err instanceof Error
              ? err.message
              : 'Unable to load orders.',
          )
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false)
        }
      }
    }

    void loadOrders()

    return () => controller.abort()
  }, [getAccessToken, retryCount])

  const visibleOrders = orders.filter(
    (order) =>
      filter === 'ALL' || order.status === filter,
  )

  return (
    <main className="min-h-screen bg-page text-foreground">
      <div className="mx-auto max-w-6xl px-6 py-12">

        <h1 className="text-4xl font-bold">
          My Orders
        </h1>

        <p className="mt-3 text-muted">
          View and manage your digital purchases.
        </p>

        <div className="mt-8 flex flex-wrap gap-3">
          {filters.map((status) => (
            <button
              key={status}
              type="button"
              aria-pressed={filter === status}
              onClick={() => setFilter(status)}
              className={`rounded-lg border px-4 py-2 text-sm font-medium transition ${filter === status
                ? 'border-brand bg-brand text-brand-foreground'
                : 'border-outline bg-surface text-muted hover:text-brand'
                }`}
            >
              {status === 'ALL'
                ? 'All orders'
                : status.charAt(0) +
                status.slice(1).toLowerCase()}
            </button>
          ))}
        </div>

        {loading ? (
          <p
            role="status"
            className="mt-10 text-muted"
          >
            Loading your orders...
          </p>
        ) : error ? (
          <div className="mt-10 rounded-xl border border-outline bg-surface p-6">
            <p role="alert" className="text-red-500">
              {error}
            </p>

            <button
              type="button"
              onClick={() =>
                setRetryCount((previous) => previous + 1)
              }
              className="mt-4 font-semibold text-brand"
            >
              Try again
            </button>
          </div>
        ) : visibleOrders.length === 0 ? (
          <div className="mt-10 rounded-xl border border-outline bg-surface p-12 text-center">

            <ShoppingBag
              size={42}
              className="mx-auto text-muted"
            />

            <h2 className="mt-5 text-xl font-bold">
              No orders found
            </h2>

            <p className="mt-3 text-muted">
              {filter === 'ALL'
                ? 'Your purchases will appear here.'
                : 'No orders match this status.'}
            </p>

            <Link
              to="/products"
              className="mt-6 inline-block rounded-lg bg-brand px-6 py-3 font-semibold text-brand-foreground"
            >
              Explore marketplace
            </Link>
          </div>
        ) : (
          <div className="mt-8 space-y-5">
            {visibleOrders.map((order) => (
              <article
                key={order.order_id}
                className="rounded-xl border border-outline bg-surface p-6"
              >
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <h2 className="text-lg font-bold">
                      Order #{order.order_id}
                    </h2>

                    <p className="mt-1 text-sm text-muted">
                      {formatDate(order.created_at)}
                    </p>
                  </div>

                  <span
                    className={`rounded-full px-3 py-1 text-xs font-semibold ${getStatusClass(
                      order.status,
                    )}`}
                  >
                    {order.status}
                  </span>
                </div>

                <div className="mt-5 space-y-4 border-y border-outline py-5">
                  {order.items.map((item) => (
                    <div
                      key={item.product_id}
                      className="flex flex-wrap items-center justify-between gap-4"
                    >
                      <div className="flex items-center gap-4">
                        <img
                          src={item.thumbnail_url}
                          alt={item.title}
                          loading="lazy"
                          className="aspect-video w-24 shrink-0 rounded-lg border border-outline bg-page object-cover sm:w-32"
                        />

                        <div>
                          <p className="font-semibold">
                            {item.title}
                          </p>

                          <p className="mt-1 text-sm text-muted">
                            Digital product
                          </p>

                          <p className="mt-1 text-sm text-muted">
                            Quantity: {item.quantity}
                          </p>
                        </div>
                      </div>

                      <div className="text-right">
                        <p className="font-semibold">
                          {formatPrice(item.price_at_purchase)}
                        </p>

                        <p className="mt-1 text-xs text-muted">
                          Unit price
                        </p>
                        
                      </div>
                    </div>
                  ))}
                </div>

                <div className="mt-5 flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <p className="text-sm text-muted">
                      Order total
                    </p>

                    <p className="mt-1 text-xl font-bold">
                      {formatPrice(order.total_amount)}
                    </p>
                  </div>

                  {order.status === 'COMPLETED' && (
                    <p className="text-sm font-medium text-green-600">
                      Payment verified
                    </p>
                  )}

                  {order.status === 'PENDING' && (
                    <p className="text-sm text-muted">
                      Awaiting payment
                    </p>
                  )}
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </main>
  )
}