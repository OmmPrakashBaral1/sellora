
import {
    beforeEach,
    describe,
    expect,
    it,
    vi,
} from 'vitest'

import {
    act,
    renderHook,
    waitFor,
} from '@testing-library/react'

import { useOrderDownloads } from '../src/hooks/useOrderDownloads'

import {
    getOrderDownloads,
    downloadPurchasedProduct,
} from '../src/api/orders'

import { saveDownloadedFile } from '../src/utils/download'

import type {
    DownloadedFile,
    OrderDownloadsResponse,
} from '../src/types/order'

const { getAccessTokenMock } = vi.hoisted(() => ({
    getAccessTokenMock: vi.fn(),
}))

vi.mock('../src/context/useAuth', () => ({
    useAuth: () => ({
        getAccessToken: getAccessTokenMock,
    }),
}))

vi.mock('../src/api/orders', () => ({
    getOrderDownloads: vi.fn(),
    downloadPurchasedProduct: vi.fn(),
}))

vi.mock('../src/utils/download', () => ({
    saveDownloadedFile: vi.fn(),
}))

const ORDER_ID = 20
const PRODUCT_ID = 1
const ACCESS_TOKEN = 'test-access-token'

const metadata: OrderDownloadsResponse = {
    order_id: ORDER_ID,
    downloads: [
        {
            product_id: PRODUCT_ID,
            title: 'Test Digital Product',
            download_available: true,
            download_url: '/orders/20/downloads/1',
        },
    ],
}

const downloadedFile: DownloadedFile = {
    blob: new Blob(['Sellora test file'], {
        type: 'application/pdf',
    }),
    filename: 'sellora-product-1.pdf',
}

function deferred<T>() {
    let resolve!: (value: T) => void
    let reject!: (reason?: unknown) => void

    const promise = new Promise<T>((res, rej) => {
        resolve = res
        reject = rej
    })

    return {
        promise,
        resolve,
        reject,
    }
}

function renderCompletedOrder() {
    return renderHook(() =>
        useOrderDownloads({
            orderId: ORDER_ID,
            orderStatus: 'COMPLETED',
        }),
    )
}

beforeEach(() => {
    vi.resetAllMocks()

    getAccessTokenMock.mockResolvedValue(ACCESS_TOKEN)

    vi.mocked(getOrderDownloads)
        .mockResolvedValue(metadata)

    vi.mocked(downloadPurchasedProduct)
        .mockResolvedValue(downloadedFile)
})

describe('Order download metadata', () => {
    it.each([
        'PENDING',
        'CANCELLED',
    ])('does not retrieve downloads for a %s order', async (status) => {
        const { result } = renderHook(() =>
            useOrderDownloads({
                orderId: ORDER_ID,
                orderStatus: status,
            }),
        )

        expect(result.current.downloadsEnabled)
            .toBe(false)

        expect(result.current.downloads)
            .toEqual([])

        await act(async () => {
            await result.current.handleDownload(PRODUCT_ID)
        })

        expect(getOrderDownloads)
            .not.toHaveBeenCalled()

        expect(downloadPurchasedProduct)
            .not.toHaveBeenCalled()
    })

    it('does not retrieve downloads without an order ID', () => {
        const { result } = renderHook(() =>
            useOrderDownloads({
                orderId: null,
                orderStatus: 'COMPLETED',
            }),
        )

        expect(result.current.downloadsEnabled)
            .toBe(false)

        expect(getOrderDownloads)
            .not.toHaveBeenCalled()
    })

    it('retrieves metadata for a completed order', async () => {
        const { result } = renderCompletedOrder()

        await waitFor(() => {
            expect(result.current.downloads)
                .toEqual(metadata.downloads)
        })

        expect(result.current.downloadsEnabled)
            .toBe(true)

        expect(result.current.downloadsLoading)
            .toBe(false)

        expect(result.current.downloadsError)
            .toBeNull()

        expect(getOrderDownloads)
            .toHaveBeenCalledWith(
                ORDER_ID,
                ACCESS_TOKEN,
                expect.any(AbortSignal),
            )
    })

    it('maintains loading state until metadata arrives', async () => {
        const request = deferred<OrderDownloadsResponse>()

        vi.mocked(getOrderDownloads)
            .mockReturnValue(request.promise)

        const { result } = renderCompletedOrder()

        await waitFor(() => {
            expect(getOrderDownloads)
                .toHaveBeenCalledTimes(1)
        })

        expect(result.current.downloadsLoading)
            .toBe(true)

        await act(async () => {
            request.resolve(metadata)
        })

        expect(result.current.downloadsLoading)
            .toBe(false)

        expect(result.current.downloads)
            .toEqual(metadata.downloads)
    })

    it('handles missing authentication', async () => {
        getAccessTokenMock.mockResolvedValue(null)

        const { result } = renderCompletedOrder()

        await waitFor(() => {
            expect(result.current.downloadsError)
                .toBe('Unable to authenticate your session.')
        })

        expect(result.current.downloadsLoading)
            .toBe(false)

        expect(getOrderDownloads)
            .not.toHaveBeenCalled()
    })

    it('rejects metadata belonging to a different order', async () => {
        vi.mocked(getOrderDownloads)
            .mockResolvedValue({
                ...metadata,
                order_id: 999,
            })

        const { result } = renderCompletedOrder()

        await waitFor(() => {
            expect(result.current.downloadsError)
                .toBe('Invalid download information received.')
        })

        expect(result.current.downloads)
            .toEqual([])
    })

    it('recovers from a metadata request failure', async () => {
        vi.mocked(getOrderDownloads)
            .mockRejectedValueOnce(
                new Error('Unable to retrieve downloads'),
            )
            .mockResolvedValueOnce(metadata)

        const { result } = renderCompletedOrder()

        await waitFor(() => {
            expect(result.current.downloadsError)
                .toBe('Unable to retrieve downloads')
        })

        act(() => {
            result.current.retryDownloads()
        })

        await waitFor(() => {
            expect(result.current.downloads)
                .toEqual(metadata.downloads)
        })

        expect(result.current.downloadsError)
            .toBeNull()

        expect(getOrderDownloads)
            .toHaveBeenCalledTimes(2)
    })

    it('retrieves metadata when payment becomes completed', async () => {
        const { result, rerender } = renderHook(
            ({ status }: { status: string }) =>
                useOrderDownloads({
                    orderId: ORDER_ID,
                    orderStatus: status,
                }),
            {
                initialProps: {
                    status: 'PENDING',
                },
            },
        )

        expect(getOrderDownloads)
            .not.toHaveBeenCalled()

        rerender({
            status: 'COMPLETED',
        })

        await waitFor(() => {
            expect(result.current.downloads)
                .toEqual(metadata.downloads)
        })

        expect(getOrderDownloads)
            .toHaveBeenCalledTimes(1)
    })

    it('aborts metadata retrieval on unmount', async () => {
        const request = deferred<OrderDownloadsResponse>()

        vi.mocked(getOrderDownloads)
            .mockReturnValue(request.promise)

        const { unmount } = renderCompletedOrder()

        await waitFor(() => {
            expect(getOrderDownloads)
                .toHaveBeenCalledTimes(1)
        })

        const signal = vi.mocked(getOrderDownloads)
            .mock.calls[0][2]

        expect(signal?.aborted).toBe(false)

        unmount()

        expect(signal?.aborted).toBe(true)

        await act(async () => {
            request.resolve(metadata)
        })
    })
})

describe('Purchased product downloads', () => {
    it('downloads an available purchased product', async () => {
        const { result } = renderCompletedOrder()

        await waitFor(() => {
            expect(result.current.downloads)
                .toEqual(metadata.downloads)
        })

        await act(async () => {
            await result.current.handleDownload(PRODUCT_ID)
        })

        expect(downloadPurchasedProduct)
            .toHaveBeenCalledWith(
                ORDER_ID,
                PRODUCT_ID,
                ACCESS_TOKEN,
                expect.any(AbortSignal),
            )

        expect(saveDownloadedFile)
            .toHaveBeenCalledWith(downloadedFile)

        expect(result.current.downloadMessage)
            .toBe('Your file download has been initiated.')

        expect(result.current.activeDownloadId)
            .toBeNull()

        expect(result.current.downloadError)
            .toBeNull()
    })

    it('rejects an unavailable product', async () => {
        vi.mocked(getOrderDownloads)
            .mockResolvedValue({
                order_id: ORDER_ID,
                downloads: [
                    {
                        ...metadata.downloads[0],
                        download_available: false,
                        download_url: null,
                    },
                ],
            })

        const { result } = renderCompletedOrder()

        await waitFor(() => {
            expect(result.current.downloads)
                .toHaveLength(1)
        })

        await act(async () => {
            await result.current.handleDownload(PRODUCT_ID)
        })

        expect(result.current.downloadError)
            .toBe('This product is currently unavailable for download.')

        expect(downloadPurchasedProduct)
            .not.toHaveBeenCalled()

        expect(saveDownloadedFile)
            .not.toHaveBeenCalled()
    })

    it('rejects a product absent from download metadata', async () => {
        const { result } = renderCompletedOrder()

        await waitFor(() => {
            expect(result.current.downloads)
                .toEqual(metadata.downloads)
        })

        await act(async () => {
            await result.current.handleDownload(999)
        })

        expect(result.current.downloadError)
            .toBe('This product is currently unavailable for download.')

        expect(downloadPurchasedProduct)
            .not.toHaveBeenCalled()
    })

    it('prevents concurrent duplicate download requests', async () => {
        const request = deferred<DownloadedFile>()

        vi.mocked(downloadPurchasedProduct)
            .mockReturnValue(request.promise)

        const { result } = renderCompletedOrder()

        await waitFor(() => {
            expect(result.current.downloads)
                .toEqual(metadata.downloads)
        })

        act(() => {
            void result.current.handleDownload(PRODUCT_ID)
            void result.current.handleDownload(PRODUCT_ID)
        })

        await waitFor(() => {
            expect(downloadPurchasedProduct)
                .toHaveBeenCalledTimes(1)
        })

        expect(result.current.activeDownloadId)
            .toBe(PRODUCT_ID)

        expect(saveDownloadedFile)
            .not.toHaveBeenCalled()

        await act(async () => {
            request.resolve(downloadedFile)
        })

        expect(saveDownloadedFile)
            .toHaveBeenCalledTimes(1)

        expect(result.current.activeDownloadId)
            .toBeNull()
    })

    it('handles a download failure and permits retry', async () => {
        vi.mocked(downloadPurchasedProduct)
            .mockRejectedValueOnce(
                new Error('File not found.'),
            )
            .mockResolvedValueOnce(downloadedFile)

        const { result } = renderCompletedOrder()

        await waitFor(() => {
            expect(result.current.downloads)
                .toEqual(metadata.downloads)
        })

        await act(async () => {
            await result.current.handleDownload(PRODUCT_ID)
        })

        expect(result.current.downloadError)
            .toBe('File not found.')

        expect(result.current.activeDownloadId)
            .toBeNull()

        expect(saveDownloadedFile)
            .not.toHaveBeenCalled()

        await act(async () => {
            await result.current.handleDownload(PRODUCT_ID)
        })

        expect(result.current.downloadError)
            .toBeNull()

        expect(saveDownloadedFile)
            .toHaveBeenCalledTimes(1)

        expect(downloadPurchasedProduct)
            .toHaveBeenCalledTimes(2)
    })

    it('rejects a download when authentication is unavailable', async () => {
        const { result } = renderCompletedOrder()

        await waitFor(() => {
            expect(result.current.downloads)
                .toEqual(metadata.downloads)
        })

        getAccessTokenMock.mockResolvedValue(null)

        await act(async () => {
            await result.current.handleDownload(PRODUCT_ID)
        })

        expect(result.current.downloadError)
            .toBe('Unable to authenticate your session.')

        expect(result.current.activeDownloadId)
            .toBeNull()

        expect(downloadPurchasedProduct)
            .not.toHaveBeenCalled()
    })

    it('aborts an active download on unmount', async () => {
        const request = deferred<DownloadedFile>()

        vi.mocked(downloadPurchasedProduct)
            .mockReturnValue(request.promise)

        const { result, unmount } = renderCompletedOrder()

        await waitFor(() => {
            expect(result.current.downloads)
                .toEqual(metadata.downloads)
        })

        act(() => {
            void result.current.handleDownload(PRODUCT_ID)
        })

        await waitFor(() => {
            expect(downloadPurchasedProduct)
                .toHaveBeenCalledTimes(1)
        })

        const signal = vi.mocked(downloadPurchasedProduct)
            .mock.calls[0][3]

        expect(signal?.aborted).toBe(false)

        unmount()

        expect(signal?.aborted).toBe(true)

        await act(async () => {
            request.resolve(downloadedFile)
        })

        expect(saveDownloadedFile)
            .not.toHaveBeenCalled()
    })

    it('clears active download state when order eligibility changes', async () => {
        const request = deferred<DownloadedFile>()

        vi.mocked(downloadPurchasedProduct)
            .mockReturnValueOnce(request.promise)

        const { result, rerender } = renderHook(
            ({ status }: { status: string }) =>
                useOrderDownloads({
                    orderId: ORDER_ID,
                    orderStatus: status,
                }),
            {
                initialProps: {
                    status: 'COMPLETED',
                },
            },
        )

        await waitFor(() => {
            expect(result.current.downloads)
                .toEqual(metadata.downloads)
        })

        act(() => {
            void result.current.handleDownload(PRODUCT_ID)
        })

        await waitFor(() => {
            expect(downloadPurchasedProduct)
                .toHaveBeenCalledTimes(1)
        })

        expect(result.current.activeDownloadId)
            .toBe(PRODUCT_ID)

        const signal = vi.mocked(downloadPurchasedProduct)
            .mock.calls[0][3]

        rerender({
            status: 'CANCELLED',
        })

        expect(signal?.aborted).toBe(true)

        await act(async () => {
            request.resolve(downloadedFile)
        })

        expect(saveDownloadedFile)
            .not.toHaveBeenCalled()

        rerender({
            status: 'COMPLETED',
        })

        await waitFor(() => {
            expect(result.current.downloads)
                .toEqual(metadata.downloads)
        })

        expect(result.current.activeDownloadId)
            .toBeNull()

        await act(async () => {
            await result.current.handleDownload(PRODUCT_ID)
        })

        expect(downloadPurchasedProduct)
            .toHaveBeenCalledTimes(2)

        expect(saveDownloadedFile)
            .toHaveBeenCalledTimes(1)
    })

})