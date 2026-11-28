import {
    afterEach,
    beforeEach,
    describe,
    expect,
    it,
    vi,
} from 'vitest'

import {
    getOrderDownloads,
    downloadPurchasedProduct,
} from '../src/api/orders'

import {
    API_BASE_URL,
    ApiError,
} from '../src/api/client'

const fetchMock = vi.fn<typeof fetch>()

const ORDER_ID = 20
const PRODUCT_ID = 1
const ACCESS_TOKEN = 'test-access-token'

beforeEach(() => {
    fetchMock.mockReset()
    vi.stubGlobal('fetch', fetchMock)
})

afterEach(() => {
    vi.unstubAllGlobals()
})

describe('Order download metadata API', () => {
    it('retrieves authenticated download metadata', async () => {
        const metadata = {
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

        fetchMock.mockResolvedValue(
            new Response(JSON.stringify(metadata), {
                status: 200,
                headers: {
                    'Content-Type': 'application/json',
                },
            }),
        )

        const result = await getOrderDownloads(
            ORDER_ID,
            ACCESS_TOKEN,
        )

        expect(result).toEqual(metadata)

        expect(fetchMock).toHaveBeenCalledTimes(1)

        expect(fetchMock).toHaveBeenCalledWith(
            `${API_BASE_URL}/orders/${ORDER_ID}/downloads`,
            expect.objectContaining({
                method: 'GET',
                headers: {
                    Authorization: `Bearer ${ACCESS_TOKEN}`,
                },
                cache: 'no-store',
            }),
        )
    })

    it('forwards the abort signal', async () => {
        const controller = new AbortController()

        fetchMock.mockResolvedValue(
            new Response(
                JSON.stringify({
                    order_id: ORDER_ID,
                    downloads: [],
                }),
                { status: 200 },
            ),
        )

        await getOrderDownloads(
            ORDER_ID,
            ACCESS_TOKEN,
            controller.signal,
        )

        expect(fetchMock).toHaveBeenCalledWith(
            expect.any(String),
            expect.objectContaining({
                signal: controller.signal,
            }),
        )
    })

    it('rejects access to an incomplete order', async () => {
        fetchMock.mockResolvedValue(
            new Response(
                JSON.stringify({
                    detail: 'Order is not completed',
                }),
                { status: 403 },
            ),
        )

        await expect(
            getOrderDownloads(ORDER_ID, ACCESS_TOKEN),
        ).rejects.toMatchObject({
            name: 'ApiError',
            status: 403,
            message: 'Order is not completed',
        })
    })

    it('preserves unavailable product metadata', async () => {
        const metadata = {
            order_id: ORDER_ID,
            downloads: [
                {
                    product_id: PRODUCT_ID,
                    title: 'Unavailable Product',
                    download_available: false,
                    download_url: null,
                },
            ],
        }

        fetchMock.mockResolvedValue(
            new Response(JSON.stringify(metadata), {
                status: 200,
            }),
        )

        const result = await getOrderDownloads(
            ORDER_ID,
            ACCESS_TOKEN,
        )

        expect(result).toEqual(metadata)
    })
})

describe('Purchased product binary download API', () => {
    it('returns the binary file and valid filename', async () => {
        const content = '%PDF-1.7\nSellora test file'

        fetchMock.mockResolvedValue(
            new Response(content, {
                status: 200,
                headers: {
                    'Content-Type': 'application/pdf',
                    'Content-Disposition':
                        'attachment; filename="sellora-product-1.pdf"',
                },
            }),
        )

        const result = await downloadPurchasedProduct(
            ORDER_ID,
            PRODUCT_ID,
            ACCESS_TOKEN,
        )

        expect(result.filename).toBe(
            'sellora-product-1.pdf',
        )

        expect(result.blob.type).toBe('application/pdf')

        expect(await result.blob.text()).toBe(content)

        expect(fetchMock).toHaveBeenCalledTimes(1)

        expect(fetchMock).toHaveBeenCalledWith(
            `${API_BASE_URL}/orders/${ORDER_ID}/downloads/${PRODUCT_ID}`,
            expect.objectContaining({
                method: 'GET',
                headers: {
                    Authorization: `Bearer ${ACCESS_TOKEN}`,
                },
                cache: 'no-store',
            }),
        )
    })

    it('uses a fallback when the filename header is missing', async () => {
        fetchMock.mockResolvedValue(
            new Response('Test file', {
                status: 200,
            }),
        )

        const result = await downloadPurchasedProduct(
            ORDER_ID,
            PRODUCT_ID,
            ACCESS_TOKEN,
        )

        expect(result.filename).toBe(
            'sellora-product-1',
        )
    })

    it.each([
        '../../private-file.pdf',
        'malicious.exe',
        'sellora-product-1.exe',
        'unexpected-file.pdf',
        'sellora-product-999.pdf',
    ])('rejects an unexpected filename: %s', async (filename) => {
        fetchMock.mockResolvedValue(
            new Response('Test file', {
                status: 200,
                headers: {
                    'Content-Disposition':
                        `attachment; filename="${filename}"`,
                },
            }),
        )

        const result = await downloadPurchasedProduct(
            ORDER_ID,
            PRODUCT_ID,
            ACCESS_TOKEN,
        )

        expect(result.filename).toBe(
            'sellora-product-1',
        )
    })

    it('rejects an unauthorized file request', async () => {
        fetchMock.mockResolvedValue(
            new Response(
                JSON.stringify({
                    detail: 'Valid payment is required for downloads',
                }),
                { status: 403 },
            ),
        )

        await expect(
            downloadPurchasedProduct(
                ORDER_ID,
                PRODUCT_ID,
                ACCESS_TOKEN,
            ),
        ).rejects.toMatchObject({
            status: 403,
            message: 'Valid payment is required for downloads',
        })
    })

    it('rejects a missing product file', async () => {
        fetchMock.mockResolvedValue(
            new Response(
                JSON.stringify({
                    detail: 'File not found.',
                }),
                { status: 404 },
            ),
        )

        await expect(
            downloadPurchasedProduct(
                ORDER_ID,
                PRODUCT_ID,
                ACCESS_TOKEN,
            ),
        ).rejects.toMatchObject({
            status: 404,
            message: 'File not found.',
        })
    })

    it('handles a non-JSON server error', async () => {
        fetchMock.mockResolvedValue(
            new Response('Internal Server Error', {
                status: 500,
            }),
        )

        await expect(
            downloadPurchasedProduct(
                ORDER_ID,
                PRODUCT_ID,
                ACCESS_TOKEN,
            ),
        ).rejects.toThrow(ApiError)
    })

    it('propagates network failures', async () => {
        fetchMock.mockRejectedValue(
            new TypeError('Failed to fetch'),
        )

        await expect(
            downloadPurchasedProduct(
                ORDER_ID,
                PRODUCT_ID,
                ACCESS_TOKEN,
            ),
        ).rejects.toThrow('Failed to fetch')
    })

    it('forwards the download abort signal', async () => {
        const controller = new AbortController()

        fetchMock.mockResolvedValue(
            new Response('Test file', {
                status: 200,
            }),
        )

        await downloadPurchasedProduct(
            ORDER_ID,
            PRODUCT_ID,
            ACCESS_TOKEN,
            controller.signal,
        )

        expect(fetchMock).toHaveBeenCalledWith(
            expect.any(String),
            expect.objectContaining({
                signal: controller.signal,
            }),
        )
    })
    it('preserves the extension using the response MIME type', async () => {
        fetchMock.mockResolvedValue(
            new Response('Test PDF file', {
                status: 200,
                headers: {
                    'Content-Type': 'application/pdf',
                },
            }),
        )

        const result = await downloadPurchasedProduct(
            ORDER_ID,
            PRODUCT_ID,
            ACCESS_TOKEN,
        )

        expect(result.filename).toBe(
            'sellora-product-1.pdf',
        )
    })

    it('uses a MIME-based fallback for a mismatched product filename', async () => {
        fetchMock.mockResolvedValue(
            new Response('Test ZIP file', {
                status: 200,
                headers: {
                    'Content-Type': 'application/zip',
                    'Content-Disposition':
                        'attachment; filename="sellora-product-999.zip"',
                },
            }),
        )

        const result = await downloadPurchasedProduct(
            ORDER_ID,
            PRODUCT_ID,
            ACCESS_TOKEN,
        )

        expect(result.filename).toBe(
            'sellora-product-1.zip',
        )
    })
})