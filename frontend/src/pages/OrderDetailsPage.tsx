import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router'

import {
  ArrowLeft,
  CheckCircle2,
  Clock,
  Download,
  ShieldCheck,
  XCircle,
} from 'lucide-react'


import { getOrderById } from '../api/orders'
import { useAuth } from '../context/useAuth'
import { useOrderPayment } from '../hooks/useOrderPayment'
import { useOrderDownloads } from '../hooks/useOrderDownloads'

import type { BuyerOrderDetails } from '../types/order'

const currencyFormatter = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
})

function formatPrice(amount: string | number) {
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
    month: 'long',
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

export default function OrderDetailsPage() {
  const { orderId } = useParams<{ orderId: string }>()
  const { getAccessToken } = useAuth()

  const [order, setOrder] =
    useState<BuyerOrderDetails | null>(null)

  const [loading, setLoading] = useState(true)

  const [error, setError] =
    useState<string | null>(null)

  const [retryCount, setRetryCount] = useState(0)

  const {
    paymentStage,
    paymentError,
    paymentMessage,
    paymentBusy,
    paymentBlocked,
    paymentButtonLabel,
    handlePayment,
    handleReconciliation,
  } = useOrderPayment({
    orderId: order?.order_id ?? null,
    orderStatus: order?.status ?? null,

    onSuccess: () => {
      setOrder((previous) =>
        previous
          ? {
            ...previous,
            status: 'COMPLETED',
          }
          : previous,
      )
    },
  })

  const {
    downloads,
    downloadsLoading,
    downloadsError,
    downloadError,
    downloadMessage,
    activeDownloadId,
    retryDownloads,
    handleDownload,
  } = useOrderDownloads({
    orderId: order?.order_id ?? null,
    orderStatus: order?.status ?? null,
  })

  useEffect(() => {
    const controller = new AbortController()

    async function loadOrder() {
      setLoading(true)
      setError(null)

      const id = Number(orderId)

      if (
        !orderId ||
        !/^[1-9]\d*$/.test(orderId) ||
        !Number.isSafeInteger(id)
      ) {
        setError('Invalid order ID.')
        setLoading(false)
        return
      }

      try {
        const token = await getAccessToken()

        if (controller.signal.aborted) return

        if (!token) {
          throw new Error(
            'Unable to authenticate your session.',
          )
        }

        const data = await getOrderById(
          id,
          token,
          controller.signal,
        )

        if (!controller.signal.aborted) {
          setOrder(data)
        }
      } catch (err) {
        if (!controller.signal.aborted) {
          setError(
            err instanceof Error
              ? err.message
              : 'Unable to load order details.',
          )
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false)
        }
      }
    }

    void loadOrder()

    return () => controller.abort()
  }, [orderId, getAccessToken, retryCount])

  if (loading) {
    return (
      <main className="mx-auto max-w-6xl px-6 py-20">
        <p role="status" className="text-muted">
          Loading order details...
        </p>
      </main>
    )
  }

  if (error || !order) {
    return (
      <main className="mx-auto max-w-6xl px-6 py-20">
        <h1 className="text-3xl font-bold">
          Order unavailable
        </h1>

        <p role="alert" className="mt-4 text-muted">
          {error ?? 'Unable to retrieve this order.'}
        </p>

        <div className="mt-6 flex flex-wrap gap-5">
          <button
            type="button"
            onClick={() =>
              setRetryCount((previous) => previous + 1)
            }
            className="font-semibold text-brand"
          >
            Try again
          </button>

          <Link
            to="/orders"
            className="font-semibold text-brand"
          >
            Back to My Orders
          </Link>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-page text-foreground">
      <div className="mx-auto max-w-6xl px-6 py-12">

        <Link
          to="/orders"
          className="inline-flex items-center gap-2 text-sm text-muted hover:text-brand"
        >
          <ArrowLeft size={18} />
          Back to My Orders
        </Link>

        <div className="mt-6 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-4xl font-bold">
              Order #{order.order_id}
            </h1>

            <p className="mt-3 text-muted">
              Placed on {formatDate(order.created_at)}
            </p>
          </div>

          <span
            className={`rounded-full px-4 py-2 text-sm font-semibold ${getStatusClass(
              order.status,
            )}`}
          >
            {order.status}
          </span>
        </div>

        <div className="mt-10 grid gap-8 lg:grid-cols-[1fr_360px]">

          <section className="space-y-6">
            <div className="rounded-xl border border-outline bg-surface p-6">
              <h2 className="text-xl font-bold">
                Order items
              </h2>

              <div className="mt-6 divide-y divide-outline">
                {order.items.map((item) => (
                  <div
                    key={item.product_id}
                    className="flex flex-wrap items-start justify-between gap-5 py-5"
                  >
                    <div className="flex items-start gap-4">
                      <img
                        src={item.thumbnail_url}
                        alt={item.title}
                        loading="lazy"
                        className="aspect-video w-28 shrink-0 rounded-lg border border-outline bg-page object-cover sm:w-36"
                      />

                      <div>
                        <h3 className="font-semibold">
                          {item.title}
                        </h3>

                        <p className="mt-2 text-sm text-muted">
                          Digital product
                        </p>

                        <p className="mt-2 text-sm text-muted">
                          Quantity: {item.quantity}
                        </p>

                        <p className="mt-2 text-sm text-muted">
                          Unit price:{' '}
                          {formatPrice(item.price_at_purchase)}
                        </p>
                      </div>
                    </div>

                    <div className="text-right">
                      <p className="font-bold">
                        {formatPrice(
                          Number(item.price_at_purchase) *
                          item.quantity,
                        )}
                      </p>

                      <p className="mt-1 text-xs text-muted">
                        Item total
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-xl border border-outline bg-surface p-6">
              <h2 className="text-xl font-bold">
                Payment information
              </h2>

              {order.status === 'COMPLETED' ? (
                <div className="mt-5 flex items-start gap-3">
                  <CheckCircle2
                    size={24}
                    className="shrink-0 text-green-500"
                  />

                  <div>
                    <p className="font-semibold text-green-600">
                      Payment completed
                    </p>

                    <p className="mt-2 text-sm text-muted">
                      Your order has been successfully completed.
                    </p>
                  </div>
                </div>
              ) : order.status === 'PENDING' ? (
                <div className="mt-5 flex items-start gap-3">
                  <Clock
                    size={24}
                    className="shrink-0 text-amber-500"
                  />

                  <div>
                    <p className="font-semibold text-amber-600">
                      Awaiting payment confirmation
                    </p>

                    <p className="mt-2 text-sm text-muted">
                      You can continue payment for this existing
                      order if you have not already paid.
                    </p>
                  </div>
                </div>
              ) : order.status === 'CANCELLED' ? (
                <div className="mt-5 flex items-start gap-3">
                  <XCircle
                    size={24}
                    className="shrink-0 text-red-500"
                  />

                  <div>
                    <p className="font-semibold text-red-500">
                      Order cancelled
                    </p>

                    <p className="mt-2 text-sm text-muted">
                      Payment is unavailable for this order.
                    </p>
                  </div>
                </div>
              ) : (
                <p className="mt-5 text-sm text-muted">
                  Payment status is currently unavailable.
                </p>
              )}
            </div>
          </section>

          <aside className="h-fit rounded-xl border border-outline bg-surface p-6">
            <h2 className="text-xl font-bold">
              Order summary
            </h2>

            <div className="mt-6 flex justify-between">
              <span className="text-muted">
                Total quantity
              </span>

              <span>
                {order.items.reduce(
                  (total, item) => total + item.quantity,
                  0,
                )}
              </span>
            </div>

            <div className="mt-6 flex justify-between border-t border-outline pt-5 font-bold">
              <span>Order total</span>

              <span>
                {formatPrice(order.total_amount)}
              </span>
            </div>

            {paymentError && (
              <p
                role="alert"
                className="mt-5 text-sm text-red-500"
              >
                {paymentError}
              </p>
            )}

            {paymentMessage && (
              <p
                role="status"
                className="mt-5 text-sm text-muted"
              >
                {paymentMessage}
              </p>
            )}

            {order.status === 'PENDING' && (
              <>
                <p className="mt-5 text-sm text-muted">
                  If money has already been deducted, do not
                  initiate another payment until your previous
                  payment has been confirmed.
                </p>

                {paymentStage === 'verification_pending' && (
                  <p className="mt-3 text-sm text-amber-600">
                    Your payment may have been received.
                    Retry verification instead of paying again.
                  </p>
                )}

                {paymentStage === 'recovery_required' && (
                  <div
                    role="alert"
                    className="mt-4 rounded-lg border border-amber-500/20 bg-amber-500/10 p-4"
                  >
                    <p className="font-semibold text-amber-600">
                      Payment status unresolved
                    </p>

                    <p className="mt-2 text-sm text-muted">
                      A previous payment attempt may still be
                      processing. Check your payment status before
                      attempting another payment.
                    </p>
                  </div>
                )}

                <button
                  type="button"
                  onClick={handlePayment}
                  disabled={
                    paymentBusy ||
                    paymentBlocked ||
                    paymentStage === 'success'
                  }
                  className="mt-6 w-full rounded-lg bg-brand px-5 py-3 font-semibold text-brand-foreground disabled:opacity-50"
                >
                  {paymentStage === 'idle'
                    ? 'Resume payment'
                    : paymentButtonLabel}
                </button>

                <button
                  type="button"
                  onClick={handleReconciliation}
                  disabled={
                    paymentBusy ||
                    paymentStage === 'success'
                  }
                  className="mt-3 w-full rounded-lg border border-brand px-5 py-3 text-sm font-semibold text-brand transition hover:bg-brand/10 disabled:opacity-50"
                >
                  {paymentStage === 'reconciling'
                    ? 'Checking payment status...'
                    : 'Check payment status'}
                </button>

                <button
                  type="button"
                  disabled={
                    paymentBusy ||
                    paymentStage === 'verification_pending'
                  }
                  onClick={() =>
                    setRetryCount((previous) => previous + 1)
                  }
                  className="mt-3 w-full rounded-lg border border-outline px-5 py-3 text-sm font-semibold hover:bg-page disabled:opacity-50"
                >
                  Refresh order status
                </button>
              </>
            )}


            {order.status === 'COMPLETED' && (
              <div className="mt-6 border-t border-outline pt-6">
                <div className="flex items-center gap-2">
                  <Download
                    size={20}
                    className="text-brand"
                  />

                  <h3 className="font-bold">
                    Product downloads
                  </h3>
                </div>

                <p className="mt-2 text-sm text-muted">
                  Access your purchased digital products.
                </p>

                {downloadsLoading && (
                  <p
                    role="status"
                    className="mt-4 text-sm text-muted"
                  >
                    Loading product downloads...
                  </p>
                )}

                {downloadsError && (
                  <div className="mt-4">
                    <p
                      role="alert"
                      className="text-sm text-red-500"
                    >
                      {downloadsError}
                    </p>

                    <button
                      type="button"
                      onClick={retryDownloads}
                      className="mt-3 text-sm font-semibold text-brand"
                    >
                      Retry loading downloads
                    </button>
                  </div>
                )}

                {!downloadsLoading &&
                  !downloadsError &&
                  downloads.length === 0 && (
                    <p className="mt-4 text-sm text-muted">
                      No product downloads are currently available.
                    </p>
                  )}

                {!downloadsLoading &&
                  !downloadsError &&
                  downloads.length > 0 && (
                    <div className="mt-5 space-y-4">
                      {downloads.map((product) => (
                        <div
                          key={product.product_id}
                          className="rounded-lg border border-outline p-4"
                        >
                          <p className="break-words text-sm font-semibold">
                            {product.title}
                          </p>

                          {product.download_available &&
                            product.download_url ? (
                            <>
                              <p className="mt-2 text-xs text-green-600">
                                Available for download
                              </p>

                              <button
                                type="button"
                                disabled={activeDownloadId !== null}
                                onClick={() =>
                                  void handleDownload(product.product_id)
                                }
                                className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg bg-brand px-4 py-2.5 text-sm font-semibold text-brand-foreground disabled:opacity-50"
                              >
                                <Download size={16} />

                                {activeDownloadId === product.product_id
                                  ? 'Downloading...'
                                  : 'Download'}
                              </button>
                            </>
                          ) : (
                            <p className="mt-2 text-xs text-muted">
                              File currently unavailable
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                {downloadError && (
                  <p
                    role="alert"
                    className="mt-4 text-sm text-red-500"
                  >
                    {downloadError}
                  </p>
                )}

                {downloadMessage && (
                  <p
                    role="status"
                    className="mt-4 text-sm text-green-600"
                  >
                    {downloadMessage}
                  </p>
                )}
              </div>
            )}


            {order.status === 'CANCELLED' && (
              <p className="mt-6 text-sm text-muted">
                No payment action is available.
              </p>
            )}

            <div className="mt-6 flex items-center gap-2 text-sm text-muted">
              <ShieldCheck size={18} />
              Secure payment verification
            </div>
          </aside>
        </div>
      </div>
    </main>
  )
}