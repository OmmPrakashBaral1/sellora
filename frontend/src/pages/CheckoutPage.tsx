import { useEffect, useRef, useState } from 'react'
import { useOrderPayment } from '../hooks/useOrderPayment'
import { createOrder } from '../api/orders'
import type { OrderCreateResponse } from '../types/order'
import { Link, useParams } from 'react-router'
import { ArrowLeft, ShieldCheck } from 'lucide-react'

import { getMarketplaceProductById } from '../api/products'
import { useAuth } from '../context/useAuth'
import type { PublicProduct } from '../types/product'

export default function CheckoutPage() {
    const { productId } = useParams<{ productId: string }>()
    const { user, getAccessToken } = useAuth()

    const [product, setProduct] =
        useState<PublicProduct | null>(null)

    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [creatingOrder, setCreatingOrder] = useState(false)

    const [orderError, setOrderError] =
        useState<string | null>(null)

    const [createdOrder, setCreatedOrder] =
        useState<OrderCreateResponse | null>(null)

    const submissionRef = useRef(false)

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
        orderId: createdOrder?.order_id ?? null,
        orderStatus: createdOrder?.status ?? null,

        onSuccess: () => {
            setCreatedOrder((previous) =>
                previous
                    ? {
                        ...previous,
                        status: 'COMPLETED',
                    }
                    : previous,
            )
        },
    })

    useEffect(() => {
        const controller = new AbortController()

        async function loadProduct() {
            setLoading(true)
            setError(null)
            setProduct(null)

            const id = Number(productId)

            if (
                !productId ||
                !Number.isSafeInteger(id) ||
                id <= 0
            ) {
                setError('Invalid product ID.')
                setLoading(false)
                return
            }

            try {
                const data = await getMarketplaceProductById(
                    id,
                    controller.signal,
                )

                if (!controller.signal.aborted) {
                    setProduct(data)
                }
            } catch (err) {
                if (!controller.signal.aborted) {
                    setError(
                        err instanceof Error
                            ? err.message
                            : 'Unable to load checkout.',
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
    async function handleCreateOrder() {
        if (
            !product ||
            !user ||
            submissionRef.current ||
            createdOrder
        ) {
            return
        }

        submissionRef.current = true
        setCreatingOrder(true)
        setOrderError(null)

        try {
            const accessToken = await getAccessToken()

            if (!accessToken) {
                throw new Error(
                    'Unable to authenticate your session. Please try again.',
                )
            }

            const result = await createOrder(
                {
                    items: [
                        {
                            product_id: product.id,
                            quantity: 1,
                        },
                    ],
                },
                accessToken,
            )

            setCreatedOrder(result)
        } catch (err) {
            setOrderError(
                err instanceof Error
                    ? err.message
                    : 'Unable to create order.',
            )
        } finally {
            submissionRef.current = false
            setCreatingOrder(false)
        }
    }

    if (loading) {
        return (
            <main className="mx-auto max-w-5xl px-6 py-20">
                <p role="status" className="text-muted">
                    Loading checkout...
                </p>
            </main>
        )
    }

    if (error || !product) {
        return (
            <main className="mx-auto max-w-5xl px-6 py-20">
                <h1 className="text-3xl font-bold">
                    Checkout unavailable
                </h1>

                <p role="alert" className="mt-4 text-muted">
                    {error ?? 'This product is unavailable.'}
                </p>

                <Link
                    to="/products"
                    className="mt-6 inline-block font-semibold text-brand"
                >
                    Return to marketplace
                </Link>
            </main>
        )
    }

    const formattedPrice = new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: 'INR',
    }).format(Number(product.price))

    const formattedTotal = new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: 'INR',
    }).format(
        Number(createdOrder?.total_amount ?? product.price),
    )

    return (
        <main className="min-h-screen bg-page text-foreground">
            <div className="mx-auto max-w-5xl px-6 py-12">
                <Link
                    to={`/products/${product.id}`}
                    className="inline-flex items-center gap-2 text-sm text-muted hover:text-brand"
                >
                    <ArrowLeft size={18} />
                    Back to product
                </Link>

                <h1 className="mt-6 text-4xl font-bold">
                    Checkout
                </h1>

                <p className="mt-3 text-muted">
                    Review your purchase details.
                </p>

                <div className="mt-10 grid gap-8 lg:grid-cols-[1fr_360px]">
                    <section className="space-y-6">
                        <div className="rounded-xl border border-outline bg-surface p-6">
                            <h2 className="text-xl font-bold">
                                Account details
                            </h2>

                            <p className="mt-4 font-medium">
                                {user?.name}
                            </p>

                            <p className="mt-1 text-sm text-muted">
                                {user?.gmail}
                            </p>
                        </div>

                        <div className="rounded-xl border border-outline bg-surface p-6">
                            <h2 className="text-xl font-bold">
                                Your product
                            </h2>

                            <div className="mt-5 flex items-start gap-4">
                                <img
                                    src={product.thumbnail_url}
                                    alt={product.title}
                                    className="aspect-video w-28 rounded-lg object-cover sm:w-40"
                                />

                                <div>
                                    <h3 className="font-semibold">
                                        {product.title}
                                    </h3>

                                    <p className="mt-2 text-sm text-muted">
                                        Digital product
                                    </p>

                                    <p className="mt-2 text-sm text-muted">
                                        Quantity: 1
                                    </p>

                                    <p className="mt-3 font-bold text-brand">
                                        {formattedPrice}
                                    </p>
                                </div>
                            </div>
                        </div>
                    </section>

                    <aside className="h-fit rounded-xl border border-outline bg-surface p-6">
                        <h2 className="text-xl font-bold">
                            Order summary
                        </h2>

                        <div className="mt-6 flex justify-between">
                            <span className="text-muted">
                                Subtotal
                            </span>
                            <span>{formattedPrice}</span>
                        </div>

                        <div className="mt-6 flex justify-between border-t border-outline pt-5 font-bold">
                            <span>
                                {createdOrder ? 'Order total' : 'Estimated total'}
                            </span>

                            <span>{formattedTotal}</span>
                        </div>

                        {orderError && (
                            <p
                                role="alert"
                                className="mt-5 text-sm text-red-500"
                            >
                                {orderError}
                            </p>
                        )}

                        {createdOrder ? (
                            <div
                                role="status"
                                className="mt-6 rounded-lg border border-outline bg-page p-4"
                            >
                                <p className="font-semibold text-green-500">
                                    Order created successfully
                                </p>

                                <p className="mt-2 text-sm text-muted">
                                    Order ID: #{createdOrder.order_id}
                                </p>

                                <p className="mt-1 text-sm text-muted">
                                    Status: {createdOrder.status}
                                </p>

                                {paymentError && (
                                    <p
                                        role="alert"
                                        className="mt-4 text-sm text-red-500"
                                    >
                                        {paymentError}
                                    </p>
                                )}

                                {paymentMessage && (
                                    <p
                                        role="status"
                                        className="mt-4 text-sm text-muted"
                                    >
                                        {paymentMessage}
                                    </p>
                                )}

                                {paymentStage === 'verification_pending' && (
                                    <p className="mt-3 text-sm text-muted">
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
                                            Check your previous payment status
                                            before attempting another payment.
                                        </p>
                                    </div>
                                )}

                                <button
                                    type="button"
                                    onClick={handlePayment}
                                    disabled={
                                        paymentBusy ||
                                        paymentBlocked ||
                                        paymentStage === 'success' ||
                                        createdOrder.status !== 'PENDING'
                                    }
                                    className="mt-5 w-full rounded-lg bg-brand px-5 py-3 font-semibold text-brand-foreground disabled:opacity-50"
                                >
                                    {paymentButtonLabel}
                                </button>

                                {createdOrder.status === 'PENDING' && (
                                    <Link
                                        to={`/orders/${createdOrder.order_id}`}
                                        className="mt-3 block text-center text-sm font-semibold text-brand hover:underline"
                                    >
                                        View order details
                                    </Link>
                                )}

                                {createdOrder.status === 'PENDING' && (
                                    <button
                                        type="button"
                                        onClick={handleReconciliation}
                                        disabled={paymentBusy}
                                        className="mt-3 w-full rounded-lg border border-brand px-5 py-3 text-sm font-semibold text-brand transition hover:bg-brand/10 disabled:opacity-50"
                                    >
                                        {paymentStage === 'reconciling'
                                            ? 'Checking payment status...'
                                            : 'Check payment status'}
                                    </button>
                                )}

                                {paymentStage === 'success' && (
                                    <Link
                                        to="/orders"
                                        className="mt-3 block w-full rounded-lg border border-outline px-5 py-3 text-center font-semibold transition hover:bg-page"
                                    >
                                        View my orders
                                    </Link>
                                )}

                                <p className="mt-3 text-center text-xs text-muted">
                                    Payments are processed through Razorpay.
                                </p>
                            </div>
                        ) : (
                            <button
                                type="button"
                                onClick={handleCreateOrder}
                                disabled={creatingOrder}
                                className="mt-7 w-full rounded-lg bg-brand px-5 py-3 font-semibold text-brand-foreground disabled:opacity-50"
                            >
                                {creatingOrder ? 'Creating order...' : 'Confirm order'}
                            </button>
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