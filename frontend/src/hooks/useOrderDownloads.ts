import {
    useEffect,
    useRef,
    useState,
} from 'react'

import {
    getOrderDownloads,
    downloadPurchasedProduct,
} from '../api/orders'

import { useAuth } from '../context/useAuth'

import { saveDownloadedFile } from '../utils/download'

import type { OrderDownloadItem } from '../types/order'

type UseOrderDownloadsOptions = {
    orderId: number | null
    orderStatus: string | null
}

export function useOrderDownloads({
    orderId,
    orderStatus,
}: UseOrderDownloadsOptions) {
    const { getAccessToken } = useAuth()

    const [downloads, setDownloads] =
        useState<OrderDownloadItem[]>([])

    const [downloadsLoading, setDownloadsLoading] =
        useState(false)

    const [downloadsError, setDownloadsError] =
        useState<string | null>(null)

    const [downloadError, setDownloadError] =
        useState<string | null>(null)

    const [downloadMessage, setDownloadMessage] =
        useState<string | null>(null)

    const [activeDownloadId, setActiveDownloadId] =
        useState<number | null>(null)

    const [retryCount, setRetryCount] =
        useState(0)

    const downloadControllerRef =
        useRef<AbortController | null>(null)

    const downloadsEnabled =
        orderId !== null &&
        orderStatus === 'COMPLETED'
    const [downloadScope, setDownloadScope] = useState({
        orderId,
        downloadsEnabled,
    })

    if (
        downloadScope.orderId !== orderId ||
        downloadScope.downloadsEnabled !== downloadsEnabled
    ) {
        setDownloadScope({
            orderId,
            downloadsEnabled,
        })

        setActiveDownloadId(null)
        setDownloadError(null)
        setDownloadMessage(null)
    }

    useEffect(() => {
        const controller = new AbortController()

        async function loadDownloads() {
            if (!downloadsEnabled || orderId === null) {
                setDownloads([])
                setDownloadsLoading(false)
                setDownloadsError(null)
                return
            }

            setDownloadsLoading(true)
            setDownloadsError(null)
            setDownloads([])

            try {
                const token = await getAccessToken()

                if (controller.signal.aborted) return

                if (!token) {
                    throw new Error(
                        'Unable to authenticate your session.',
                    )
                }

                const result = await getOrderDownloads(
                    orderId,
                    token,
                    controller.signal,
                )

                if (controller.signal.aborted) return

                if (result.order_id !== orderId) {
                    throw new Error(
                        'Invalid download information received.',
                    )
                }

                setDownloads(result.downloads)
            } catch (err) {
                if (!controller.signal.aborted) {
                    setDownloadsError(
                        err instanceof Error
                            ? err.message
                            : 'Unable to load product downloads.',
                    )
                }
            } finally {
                if (!controller.signal.aborted) {
                    setDownloadsLoading(false)
                }
            }
        }

        void loadDownloads()

        return () => controller.abort()
    }, [
        orderId,
        downloadsEnabled,
        getAccessToken,
        retryCount,
    ])

    useEffect(() => {
        return () => {
            downloadControllerRef.current?.abort()
            downloadControllerRef.current = null
        }
    }, [orderId, downloadsEnabled])

    function retryDownloads() {
        if (downloadControllerRef.current) return

        setRetryCount((previous) => previous + 1)
    }

    async function handleDownload(productId: number) {
        if (
            !downloadsEnabled ||
            orderId === null ||
            downloadsLoading ||
            downloadsError ||
            downloadControllerRef.current
        ) {
            return
        }

        const product = downloads.find(
            (item) => item.product_id === productId,
        )

        if (
            !product ||
            !product.download_available ||
            !product.download_url
        ) {
            setDownloadError(
                'This product is currently unavailable for download.',
            )
            return
        }

        const controller = new AbortController()

        downloadControllerRef.current = controller

        setActiveDownloadId(productId)
        setDownloadError(null)
        setDownloadMessage(null)

        try {
            const token = await getAccessToken()

            if (controller.signal.aborted) return

            if (!token) {
                throw new Error(
                    'Unable to authenticate your session.',
                )
            }

            const file = await downloadPurchasedProduct(
                orderId,
                productId,
                token,
                controller.signal,
            )

            if (controller.signal.aborted) return

            saveDownloadedFile(file)

            setDownloadMessage(
                'Your file download has been initiated.',
            )
        } catch (err) {
            if (!controller.signal.aborted) {
                setDownloadError(
                    err instanceof Error
                        ? err.message
                        : 'Unable to download this product.',
                )
            }
        } finally {
            if (
                downloadControllerRef.current === controller
            ) {
                downloadControllerRef.current = null

                setActiveDownloadId(null)
            }
        }
    }

    return {
        downloads,
        downloadsEnabled,
        downloadsLoading,
        downloadsError,
        downloadError,
        downloadMessage,
        activeDownloadId,
        retryDownloads,
        handleDownload,
    }
}