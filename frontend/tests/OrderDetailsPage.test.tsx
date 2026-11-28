import '@testing-library/jest-dom/vitest'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  act,
  render,
  screen,
} from '@testing-library/react'

import userEvent from '@testing-library/user-event'

import {
  MemoryRouter,
  Route,
  Routes,
} from 'react-router'

import OrderDetailsPage from '../src/pages/OrderDetailsPage'

import { getOrderById } from '../src/api/orders'

import {
  createPayment,
  verifyPayment,
  reconcilePayment,
} from '../src/api/payments'

import {
  loadRazorpay,
  openRazorpayCheckout,
} from '../src/utils/razorpay'

import type { BuyerOrderDetails } from '../src/types/order'

import type {
  PaymentCreateResponse,
  PaymentVerifyRequest,
  PaymentVerifyResponse,
  PaymentReconcileResponse,
} from '../src/types/payment'


// Mock external dependencies

vi.mock('../src/api/orders', () => ({
  getOrderById: vi.fn(),
}))

vi.mock('../src/api/payments', () => ({
  createPayment: vi.fn(),
  verifyPayment: vi.fn(),
  reconcilePayment: vi.fn(),
}))

vi.mock('../src/utils/razorpay', () => ({
  loadRazorpay: vi.fn(),
  openRazorpayCheckout: vi.fn(),
}))

vi.mock('../src/context/useAuth', () => {
  const getAccessToken = async () => 'test-access-token'

  const user = {
    id: 1,
    name: 'Test Buyer',
    gmail: 'buyer@example.com',
    role: 'BUYER',
  }

  return {
    useAuth: () => ({
      user,
      getAccessToken,
    }),
  }
})


// Mock function references

const mockGetOrder = vi.mocked(getOrderById)
const mockCreatePayment = vi.mocked(createPayment)
const mockVerifyPayment = vi.mocked(verifyPayment)
const mockReconcilePayment = vi.mocked(reconcilePayment)
const mockLoadRazorpay = vi.mocked(loadRazorpay)
const mockOpenCheckout = vi.mocked(openRazorpayCheckout)


// Test constants

const ORDER_ID = 20
const ACCESS_TOKEN = 'test-access-token'

const pendingOrder: BuyerOrderDetails = {
  order_id: ORDER_ID,
  buyer_id: 1,
  total_amount: '499.00',
  status: 'PENDING',
  created_at: '2026-11-28T04:00:00Z',

  items: [
    {
      product_id: 101,
      title: 'Test Digital Product',
      thumbnail_url: 'https://example.com/product.jpg',
      price_at_purchase: '499.00',
      quantity: 1,
    },
  ],
}

const paymentResponse: PaymentCreateResponse = {
  message: 'Payment initialized',
  payment_id: 10,
  razorpay_key_id: 'rzp_test_example',
  razorpay_order_id: 'order_test_123',
  amount: 49900,
  currency: 'INR',
}

const paymentCredentials: PaymentVerifyRequest = {
  razorpay_order_id: 'order_test_123',
  razorpay_payment_id: 'pay_test_123',
  razorpay_signature: 'test_signature',
}

const verificationResponse: PaymentVerifyResponse = {
  message: 'Payment verified successfully',
  payment_id: 10,
  order_id: ORDER_ID,
  payment_status: 'SUCCESS',
  order_status: 'COMPLETED',
  completed_seller_orders: 1,
}

const notInitiatedResponse: PaymentReconcileResponse = {
  message: 'No payment attempt exists for this order',
  order_id: ORDER_ID,
  order_status: 'PENDING',
  payment_status: 'NOT_INITIATED',
  reconciled: false,
}

const pendingResponse: PaymentReconcileResponse = {
  message: 'No captured payment was found',
  order_id: ORDER_ID,
  order_status: 'PENDING',
  payment_status: 'PENDING',
  reconciled: false,
}

const recoveredResponse: PaymentReconcileResponse = {
  message: 'Payment reconciled successfully',
  order_id: ORDER_ID,
  payment_id: 10,
  order_status: 'COMPLETED',
  payment_status: 'SUCCESS',
  reconciled: true,
}


// Fake Razorpay constructor

class FakeRazorpay {
  open() {}
  close() {}
}


// Deferred promise helper

function createDeferred<T>() {
  let resolve!: (value: T) => void

  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise
  })

  return {
    promise,
    resolve,
  }
}


// Reusable page rendering helper

function renderPage(orderId = String(ORDER_ID)) {
  return render(
    <MemoryRouter initialEntries={[`/orders/${orderId}`]}>
      <Routes>
        <Route
          path="/orders/:orderId"
          element={<OrderDetailsPage />}
        />
      </Routes>
    </MemoryRouter>,
  )
}


// Default mock configuration

beforeEach(() => {
  vi.resetAllMocks()

  mockGetOrder.mockResolvedValue(pendingOrder)

  mockCreatePayment.mockResolvedValue(
    paymentResponse,
  )

  mockVerifyPayment.mockResolvedValue(
    verificationResponse,
  )

  mockReconcilePayment.mockResolvedValue(
    notInitiatedResponse,
  )

  mockLoadRazorpay.mockResolvedValue(
    FakeRazorpay,
  )

  mockOpenCheckout.mockResolvedValue(
    paymentCredentials,
  )
})


describe('OrderDetailsPage payment workflow', () => {

  // Test 1

  it('displays a pending order with available payment controls', async () => {
    renderPage()

    await screen.findByRole('heading', {
      name: 'Order #20',
    })

    expect(screen.getByText('PENDING'))
      .toBeInTheDocument()

    expect(screen.getByText('Test Digital Product'))
      .toBeInTheDocument()

    expect(screen.getByText('Awaiting payment confirmation'))
      .toBeInTheDocument()

    expect(screen.getByRole('button', {
      name: 'Resume payment',
    })).toBeEnabled()

    expect(screen.getByRole('button', {
      name: 'Check payment status',
    })).toBeEnabled()

    expect(screen.getByRole('button', {
      name: 'Refresh order status',
    })).toBeEnabled()

    expect(mockGetOrder).toHaveBeenCalledWith(
      ORDER_ID,
      ACCESS_TOKEN,
      expect.any(AbortSignal),
    )

    expect(mockCreatePayment).not.toHaveBeenCalled()
  })


  // Test 2

  it('disables payment controls during initialization', async () => {
    const deferred =
      createDeferred<PaymentReconcileResponse>()

    mockReconcilePayment.mockReturnValueOnce(
      deferred.promise,
    )

    const user = userEvent.setup()

    renderPage()

    await user.click(
      await screen.findByRole('button', {
        name: 'Resume payment',
      }),
    )

    expect(await screen.findByRole('button', {
      name: 'Initializing payment...',
    })).toBeDisabled()

    expect(screen.getByRole('button', {
      name: 'Check payment status',
    })).toBeDisabled()

    expect(screen.getByRole('button', {
      name: 'Refresh order status',
    })).toBeDisabled()

    expect(mockCreatePayment).not.toHaveBeenCalled()

    await act(async () => {
      deferred.resolve(notInitiatedResponse)
    })

    expect(await screen.findByText('COMPLETED'))
      .toBeInTheDocument()
  })


  // Test 3

  it('displays a recovery warning after checkout dismissal', async () => {
    mockOpenCheckout.mockResolvedValueOnce(null)

    const user = userEvent.setup()

    renderPage()

    await user.click(
      await screen.findByRole('button', {
        name: 'Resume payment',
      }),
    )

    expect(await screen.findByRole('alert'))
      .toHaveTextContent('Payment status unresolved')

    expect(screen.getByRole('button', {
      name: 'Payment status unresolved',
    })).toBeDisabled()

    expect(screen.getByRole('button', {
      name: 'Check payment status',
    })).toBeEnabled()

    expect(screen.getByText('PENDING'))
      .toBeInTheDocument()

    expect(mockOpenCheckout).toHaveBeenCalledTimes(1)
    expect(mockVerifyPayment).not.toHaveBeenCalled()
  })


  // Test 4

  it('prevents new checkout when a previous payment exists', async () => {
    mockReconcilePayment.mockResolvedValueOnce(
      pendingResponse,
    )

    const user = userEvent.setup()

    renderPage()

    await user.click(
      await screen.findByRole('button', {
        name: 'Resume payment',
      }),
    )

    expect(await screen.findByRole('alert'))
      .toHaveTextContent('Payment status unresolved')

    expect(screen.getByRole('button', {
      name: 'Payment status unresolved',
    })).toBeDisabled()

    expect(mockLoadRazorpay).not.toHaveBeenCalled()
    expect(mockCreatePayment).not.toHaveBeenCalled()
    expect(mockOpenCheckout).not.toHaveBeenCalled()
  })


  // Test 5

  it('allows verification retry without another checkout', async () => {
    mockVerifyPayment.mockRejectedValueOnce(
      new Error('Verification unavailable'),
    )

    const user = userEvent.setup()

    renderPage()

    await user.click(
      await screen.findByRole('button', {
        name: 'Resume payment',
      }),
    )

    const retryButton =
      await screen.findByRole('button', {
        name: 'Retry verification',
      })

    expect(retryButton).toBeEnabled()

    expect(screen.getByRole('alert'))
      .toHaveTextContent('Verification unavailable')

    expect(screen.getByText(
      /Your payment may have been received/,
    )).toBeInTheDocument()

    expect(screen.getByRole('button', {
      name: 'Refresh order status',
    })).toBeDisabled()

    await user.click(retryButton)

    expect(await screen.findByText('COMPLETED'))
      .toBeInTheDocument()

    expect(mockCreatePayment).toHaveBeenCalledTimes(1)
    expect(mockOpenCheckout).toHaveBeenCalledTimes(1)
    expect(mockVerifyPayment).toHaveBeenCalledTimes(2)

    expect(mockVerifyPayment)
      .toHaveBeenNthCalledWith(
        2,
        paymentCredentials,
        ACCESS_TOKEN,
      )
  })


  // Test 6

  it('disables all payment controls during reconciliation', async () => {
    const deferred =
      createDeferred<PaymentReconcileResponse>()

    mockReconcilePayment.mockReturnValueOnce(
      deferred.promise,
    )

    const user = userEvent.setup()

    renderPage()

    await user.click(
      await screen.findByRole('button', {
        name: 'Check payment status',
      }),
    )

    const busyButtons = await screen.findAllByRole(
      'button',
      {
        name: 'Checking payment status...',
      },
    )

    expect(busyButtons).toHaveLength(2)

    for (const button of busyButtons) {
      expect(button).toBeDisabled()
    }

    expect(screen.getByRole('button', {
      name: 'Refresh order status',
    })).toBeDisabled()

    await user.click(busyButtons[0])

    expect(mockReconcilePayment)
      .toHaveBeenCalledTimes(1)

    await act(async () => {
      deferred.resolve(pendingResponse)
    })

    expect(await screen.findByRole('alert'))
      .toHaveTextContent('Payment status unresolved')

    expect(screen.getByRole('button', {
      name: 'Check payment status',
    })).toBeEnabled()
  })


  // Test 7

  it('updates the order to completed after payment recovery', async () => {
    mockVerifyPayment.mockRejectedValueOnce(
      new Error('Backend unavailable'),
    )

    const user = userEvent.setup()

    renderPage()

    await user.click(
      await screen.findByRole('button', {
        name: 'Resume payment',
      }),
    )

    await screen.findByRole('button', {
      name: 'Retry verification',
    })

    mockReconcilePayment.mockResolvedValueOnce(
      recoveredResponse,
    )

    await user.click(screen.getByRole('button', {
      name: 'Check payment status',
    }))

    expect(await screen.findByText('COMPLETED'))
      .toBeInTheDocument()

    expect(screen.getByText(
      'Payment recovered successfully. Your order is completed.',
    )).toBeInTheDocument()

    expect(screen.getByText('Purchase completed'))
      .toBeInTheDocument()

    expect(screen.queryByText('PENDING'))
      .not.toBeInTheDocument()

    expect(screen.queryByRole('button', {
      name: 'Check payment status',
    })).not.toBeInTheDocument()

    expect(screen.queryByRole('button', {
      name: 'Retry verification',
    })).not.toBeInTheDocument()

    expect(screen.queryByRole('alert'))
      .not.toBeInTheDocument()

    expect(mockCreatePayment).toHaveBeenCalledTimes(1)
    expect(mockOpenCheckout).toHaveBeenCalledTimes(1)
    expect(mockVerifyPayment).toHaveBeenCalledTimes(1)

    expect(mockReconcilePayment)
      .toHaveBeenCalledTimes(2)
  })


  // Test 8

  it('does not display payment actions for a completed order', async () => {
    mockGetOrder.mockResolvedValueOnce({
      ...pendingOrder,
      status: 'COMPLETED',
    })

    renderPage()

    expect(await screen.findByText('COMPLETED'))
      .toBeInTheDocument()

    expect(screen.getByText('Purchase completed'))
      .toBeInTheDocument()

    expect(screen.queryByRole('button', {
      name: 'Resume payment',
    })).not.toBeInTheDocument()

    expect(screen.queryByRole('button', {
      name: 'Check payment status',
    })).not.toBeInTheDocument()

    expect(screen.queryByRole('button', {
      name: 'Refresh order status',
    })).not.toBeInTheDocument()

    expect(mockCreatePayment).not.toHaveBeenCalled()
    expect(mockReconcilePayment).not.toHaveBeenCalled()
  })


  // Test 9

  it('displays reconciliation errors and allows status checking again', async () => {
    mockReconcilePayment.mockRejectedValueOnce(
      new Error('HTTP 502 Bad Gateway'),
    )

    const user = userEvent.setup()

    renderPage()

    await user.click(
      await screen.findByRole('button', {
        name: 'Check payment status',
      }),
    )

    expect(await screen.findByText('HTTP 502 Bad Gateway'))
      .toBeInTheDocument()

    expect(screen.getByRole('button', {
      name: 'Payment status unresolved',
    })).toBeDisabled()

    expect(screen.getByRole('button', {
      name: 'Check payment status',
    })).toBeEnabled()

    mockReconcilePayment.mockResolvedValueOnce(
      pendingResponse,
    )

    await user.click(screen.getByRole('button', {
      name: 'Check payment status',
    }))

    expect(await screen.findByText(
      /Payment is not yet confirmed/,
    )).toBeInTheDocument()

    expect(screen.queryByText('HTTP 502 Bad Gateway'))
      .not.toBeInTheDocument()

    expect(screen.getByRole('button', {
      name: 'Payment status unresolved',
    })).toBeDisabled()

    expect(screen.getByText('PENDING'))
      .toBeInTheDocument()

    expect(mockCreatePayment).not.toHaveBeenCalled()
    expect(mockOpenCheckout).not.toHaveBeenCalled()
  })


  // Test 10

  it('does not allow payment for a cancelled order', async () => {
    mockGetOrder.mockResolvedValueOnce({
      ...pendingOrder,
      status: 'CANCELLED',
    })

    renderPage()

    expect(await screen.findByText('CANCELLED'))
      .toBeInTheDocument()

    expect(screen.getByText(
      'No payment action is available.',
    )).toBeInTheDocument()

    expect(screen.queryByRole('button', {
      name: 'Resume payment',
    })).not.toBeInTheDocument()

    expect(screen.queryByRole('button', {
      name: 'Check payment status',
    })).not.toBeInTheDocument()

    expect(mockCreatePayment).not.toHaveBeenCalled()
    expect(mockReconcilePayment).not.toHaveBeenCalled()
  })
})


describe('OrderDetailsPage loading and validation', () => {

  // Test 11

  it('recovers from an order loading failure', async () => {
    mockGetOrder
      .mockRejectedValueOnce(
        new Error('Unable to retrieve order'),
      )
      .mockResolvedValueOnce(pendingOrder)

    const user = userEvent.setup()

    renderPage()

    expect(await screen.findByRole('alert'))
      .toHaveTextContent('Unable to retrieve order')

    expect(screen.getByRole('heading', {
      name: 'Order unavailable',
    })).toBeInTheDocument()

    await user.click(screen.getByRole('button', {
      name: 'Try again',
    }))

    expect(await screen.findByRole('heading', {
      name: 'Order #20',
    })).toBeInTheDocument()

    expect(screen.queryByRole('alert'))
      .not.toBeInTheDocument()

    expect(mockGetOrder).toHaveBeenCalledTimes(2)
  })


  // Test 12

  it('rejects an invalid order ID without contacting the backend', async () => {
    renderPage('invalid-order')

    expect(await screen.findByRole('alert'))
      .toHaveTextContent('Invalid order ID.')

    expect(screen.getByRole('heading', {
      name: 'Order unavailable',
    })).toBeInTheDocument()

    expect(mockGetOrder).not.toHaveBeenCalled()
    expect(mockCreatePayment).not.toHaveBeenCalled()
    expect(mockReconcilePayment).not.toHaveBeenCalled()
  })
})
