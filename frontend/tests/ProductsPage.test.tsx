
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'

import ProductsPage from '../src/pages/ProductsPage'
import { getMarketplaceProducts } from '../src/api/products'
import type { PublicProduct } from '../src/types/product'

vi.mock('../src/api/products', () => ({
    getMarketplaceProducts: vi.fn(),
}))

vi.mock('../src/components/ProductCard', () => ({
    default: ({ product }: { product: PublicProduct }) => (
        <div data-testid="product-card">{product.title}</div>
    ),
}))

const mockedGetProducts = vi.mocked(getMarketplaceProducts)

function makeProducts(start: number, count: number): PublicProduct[] {
    return Array.from({ length: count }, (_, index) => {
        const id = start + index

        return {
            id,
            title: `Test Product ${id}`,
            description: `Description for product ${id}`,
            price: '499.00',
            demo_url: 'https://example.com/demo',
            thumbnail_url: 'https://example.com/image.jpg',
            status: 'APPROVED',
            tags: ['test'],
        }
    })
}

function renderPage() {
    return render(
        <MemoryRouter>
            <ProductsPage />
        </MemoryRouter>
    )
}

beforeEach(() => {
    vi.resetAllMocks()
})

describe('Sellora marketplace pagination', () => {
    it('displays 12 products and enables Next when more exist', async () => {
        mockedGetProducts.mockResolvedValue(makeProducts(1, 13))

        renderPage()

        expect(screen.getByRole('status', {
            name: 'Loading products',
        })).toBeInTheDocument()

        await waitFor(() => {
            expect(screen.getAllByTestId('product-card')).toHaveLength(12)
        })

        expect(screen.getByText('Page 1')).toBeInTheDocument()

        expect(screen.getByRole('button', {
            name: 'Next',
        })).toBeEnabled()

        expect(screen.getByRole('button', {
            name: 'Previous',
        })).toBeDisabled()

        expect(mockedGetProducts).toHaveBeenCalledWith(
            expect.any(AbortSignal),
            expect.objectContaining({
                skip: 0,
                limit: 13,
                sortBy: 'newest',
            })
        )
    })

    it('navigates to page 2 and returns to page 1', async () => {
        mockedGetProducts.mockImplementation(async (_signal, filters) => {
            return filters?.skip === 12
                ? makeProducts(13, 5)
                : makeProducts(1, 13)
        })

        const user = userEvent.setup()

        renderPage()

        await screen.findByText('Test Product 1')

        await user.click(screen.getByRole('button', {
            name: 'Next',
        }))

        await screen.findByText('Test Product 13')

        expect(screen.getByText('Page 2')).toBeInTheDocument()
        expect(screen.getAllByTestId('product-card')).toHaveLength(5)

        expect(screen.getByRole('button', {
            name: 'Next',
        })).toBeDisabled()

        await user.click(screen.getByRole('button', {
            name: 'Previous',
        }))

        await screen.findByText('Test Product 1')

        expect(screen.getByText('Page 1')).toBeInTheDocument()
    })

    it('resets pagination when searching', async () => {
        mockedGetProducts.mockImplementation(async (_signal, filters) => {
            if (filters?.search === 'design') {
                return makeProducts(101, 2)
            }

            return filters?.skip === 12
                ? makeProducts(13, 5)
                : makeProducts(1, 13)
        })

        const user = userEvent.setup()

        renderPage()

        await screen.findByText('Test Product 1')

        await user.click(screen.getByRole('button', {
            name: 'Next',
        }))

        await screen.findByText('Test Product 13')

        await user.type(
            screen.getByRole('searchbox', {
                name: 'Search products',
            }),
            'design'
        )

        await user.click(screen.getByRole('button', {
            name: 'Search',
        }))

        await screen.findByText('Test Product 101')

        expect(screen.getByText('Page 1')).toBeInTheDocument()

        expect(mockedGetProducts).toHaveBeenLastCalledWith(
            expect.any(AbortSignal),
            expect.objectContaining({
                search: 'design',
                skip: 0,
                limit: 13,
            })
        )
    })

    it('resets pagination when sorting changes', async () => {
        mockedGetProducts.mockImplementation(async (_signal, filters) => {
            if (filters?.sortBy === 'price_asc') {
                return makeProducts(201, 3)
            }

            return filters?.skip === 12
                ? makeProducts(13, 5)
                : makeProducts(1, 13)
        })

        const user = userEvent.setup()

        renderPage()

        await screen.findByText('Test Product 1')

        await user.click(screen.getByRole('button', {
            name: 'Next',
        }))

        await screen.findByText('Test Product 13')

        await user.selectOptions(
            screen.getByRole('combobox', { name: 'Sort by' }),
            'price_asc'
        )

        await screen.findByText('Test Product 201')

        expect(screen.getByText('Page 1')).toBeInTheDocument()

        expect(mockedGetProducts).toHaveBeenLastCalledWith(
            expect.any(AbortSignal),
            expect.objectContaining({
                sortBy: 'price_asc',
                skip: 0,
            })
        )
    })

    it('recovers when a later page becomes empty', async () => {
        let pageTwoRequests = 0

        mockedGetProducts.mockImplementation(async (_signal, filters) => {
            if (filters?.skip === 12) {
                pageTwoRequests += 1

                return pageTwoRequests === 1
                    ? makeProducts(13, 13)
                    : []
            }

            if (filters?.skip === 24) {
                return []
            }

            return makeProducts(1, 13)
        })

        const user = userEvent.setup()

        renderPage()

        await screen.findByText('Test Product 1')

        await user.click(screen.getByRole('button', {
            name: 'Next',
        }))

        await screen.findByText('Test Product 13')

        await user.click(screen.getByRole('button', {
            name: 'Next',
        }))

        await waitFor(() => {
            expect(mockedGetProducts).toHaveBeenCalledWith(
                expect.any(AbortSignal),
                expect.objectContaining({ skip: 12 })
            )
        })

        await screen.findByText('Test Product 1')

        expect(screen.getByText('Page 1')).toBeInTheDocument()

        expect(screen.queryByText(
            'No products available yet.'
        )).not.toBeInTheDocument()
    })

    it('shows an error and successfully retries', async () => {
        mockedGetProducts
            .mockRejectedValueOnce(new Error('Network failure'))
            .mockResolvedValueOnce(makeProducts(1, 3))

        const user = userEvent.setup()

        renderPage()

        expect(await screen.findByRole('alert')).toBeInTheDocument()

        await user.click(screen.getByRole('button', {
            name: 'Try again',
        }))

        await screen.findByText('Test Product 1')

        expect(screen.queryByRole('alert')).not.toBeInTheDocument()
        expect(mockedGetProducts).toHaveBeenCalledTimes(2)
    })
})

describe('Sellora marketplace tag and price filters', () => {
    it('applies a normalized product tag', async () => {
        mockedGetProducts.mockResolvedValue(makeProducts(1, 3))

        const user = userEvent.setup()
        renderPage()

        await screen.findByText('Test Product 1')

        await user.type(
            screen.getByRole('textbox', { name: 'Product tag' }),
            ' FRONTEND '
        )

        await user.click(
            screen.getByRole('button', { name: 'Apply filters' })
        )

        await waitFor(() => {
            expect(mockedGetProducts).toHaveBeenLastCalledWith(
                expect.any(AbortSignal),
                expect.objectContaining({
                    tag: 'frontend',
                    skip: 0,
                })
            )
        })
    })

    it('applies minimum and maximum prices', async () => {
        mockedGetProducts.mockResolvedValue(makeProducts(1, 3))

        const user = userEvent.setup()
        renderPage()

        await screen.findByText('Test Product 1')

        await user.type(
            screen.getByRole('spinbutton', { name: 'Minimum price (₹)' }),
            '100'
        )

        await user.type(
            screen.getByRole('spinbutton', { name: 'Maximum price (₹)' }),
            '500'
        )

        await user.click(
            screen.getByRole('button', { name: 'Apply filters' })
        )

        await waitFor(() => {
            expect(mockedGetProducts).toHaveBeenLastCalledWith(
                expect.any(AbortSignal),
                expect.objectContaining({
                    minPrice: 100,
                    maxPrice: 500,
                    skip: 0,
                })
            )
        })
    })

    it('rejects an invalid price range without requesting products', async () => {
        mockedGetProducts.mockResolvedValue(makeProducts(1, 3))

        const user = userEvent.setup()
        renderPage()

        await screen.findByText('Test Product 1')

        const callsBefore = mockedGetProducts.mock.calls.length

        await user.type(
            screen.getByRole('spinbutton', { name: 'Minimum price (₹)' }),
            '800'
        )

        await user.type(
            screen.getByRole('spinbutton', { name: 'Maximum price (₹)' }),
            '200'
        )

        await user.click(
            screen.getByRole('button', { name: 'Apply filters' })
        )

        expect(screen.getByRole('alert')).toHaveTextContent(
            'Minimum price cannot be greater than maximum price.'
        )

        expect(mockedGetProducts).toHaveBeenCalledTimes(callsBefore)
    })

    it('resets pagination when tag filtering changes', async () => {
        mockedGetProducts.mockImplementation(async (_signal, filters) => {
            if (filters?.tag === 'frontend') {
                return makeProducts(101, 2)
            }

            return filters?.skip === 12
                ? makeProducts(13, 5)
                : makeProducts(1, 13)
        })

        const user = userEvent.setup()
        renderPage()

        await screen.findByText('Test Product 1')

        await user.click(
            screen.getByRole('button', { name: 'Next' })
        )

        await screen.findByText('Test Product 13')

        expect(screen.getByText('Page 2')).toBeInTheDocument()

        await user.type(
            screen.getByRole('textbox', { name: 'Product tag' }),
            'frontend'
        )

        await user.click(
            screen.getByRole('button', { name: 'Apply filters' })
        )

        await screen.findByText('Test Product 101')

        expect(screen.getByText('Page 1')).toBeInTheDocument()

        expect(mockedGetProducts).toHaveBeenLastCalledWith(
            expect.any(AbortSignal),
            expect.objectContaining({
                tag: 'frontend',
                skip: 0,
                limit: 13,
            })
        )
    })
    it('rejects prices with more than two decimal places', async () => {
        mockedGetProducts.mockResolvedValue(makeProducts(1, 3))

        const user = userEvent.setup()
        renderPage()

        await screen.findByText('Test Product 1')

        const callsBefore = mockedGetProducts.mock.calls.length

        const minPriceInput = screen.getByRole('spinbutton', {
            name: 'Minimum price (₹)',
        })

        await user.type(minPriceInput, '100.999')

        await user.click(
            screen.getByRole('button', { name: 'Apply filters' })
        )

        expect(screen.getByRole('alert')).toHaveTextContent(
            'Prices can have at most two decimal places.'
        )
        expect(mockedGetProducts).toHaveBeenCalledTimes(callsBefore)
    })
    it('resets tag and price filters', async () => {
        mockedGetProducts.mockResolvedValue(makeProducts(1, 3))

        const user = userEvent.setup()
        renderPage()

        await screen.findByText('Test Product 1')

        await user.type(
            screen.getByRole('textbox', { name: 'Product tag' }),
            'frontend'
        )

        await user.type(
            screen.getByRole('spinbutton', { name: 'Minimum price (₹)' }),
            '100'
        )

        await user.click(
            screen.getByRole('button', { name: 'Apply filters' })
        )

        await waitFor(() => {
            expect(mockedGetProducts).toHaveBeenLastCalledWith(
                expect.any(AbortSignal),
                expect.objectContaining({
                    tag: 'frontend',
                    minPrice: 100,
                })
            )
        })

        expect(screen.getByText('Tag: frontend')).toBeInTheDocument()

        await user.click(
            screen.getByRole('button', { name: 'Reset filters' })
        )

        await waitFor(() => {
            expect(mockedGetProducts).toHaveBeenLastCalledWith(
                expect.any(AbortSignal),
                expect.objectContaining({
                    tag: '',
                    minPrice: undefined,
                    maxPrice: undefined,
                    skip: 0,
                })
            )
        })

        expect(
            screen.getByRole('textbox', { name: 'Product tag' })
        ).toHaveValue('')

        expect(
            screen.getByRole('spinbutton', { name: 'Minimum price (₹)' })
        ).toHaveValue(null)
    })
})
