import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useOrderPayment } from '../src/hooks/useOrderPayment'

import {
  createPayment,
  verifyPayment,
  reconcilePayment,
} from '../src/api/payments'

import {
  loadRazorpay,
  openRazorpayCheckout,
} from '../src/utils/razorpay'

import type {
  PaymentCreateResponse,
  PaymentVerifyRequest,
  PaymentVerifyResponse,
  PaymentReconcileResponse,
} from '../src/types/payment'


// Mock external dependencies

vi.mock('../src/api/payments', () => ({
  createPayment: vi.fn(),
  verifyPayment: vi.fn(),
  reconcilePayment: vi.fn(),
}))

vi.mock('../src/utils/razorpay', () => ({
  loadRazorpay: vi.fn(),
  openRazorpayCheckout: vi.fn(),
}))

vi.mock('../src/context/useAuth', () => ({
  useAuth: () => ({
    user: {
      id: 1,
      name: 'Test Buyer',
      gmail: 'buyer@example.com',
      role: 'BUYER',
    },
    getAccessToken: async () => 'test-access-token',
  }),
}))


// Mock function references

const mockCreatePayment = vi.mocked(createPayment)
const mockVerifyPayment = vi.mocked(verifyPayment)
const mockReconcilePayment = vi.mocked(reconcilePayment)
const mockLoadRazorpay = vi.mocked(loadRazorpay)
const mockOpenCheckout = vi.mocked(openRazorpayCheckout)


// Test constants

const ORDER_ID = 20
const ACCESS_TOKEN = 'test-access-token'

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


// Reusable hook setup

function setupHook() {
  const onSuccess = vi.fn()

  const hook = renderHook(() =>
    useOrderPayment({
      orderId: ORDER_ID,
      orderStatus: 'PENDING',
      onSuccess,
    }),
  )

  return {
    ...hook,
    onSuccess,
  }
}


describe('useOrderPayment', () => {

  beforeEach(() => {
    vi.resetAllMocks()

    mockReconcilePayment.mockResolvedValue(
      notInitiatedResponse,
    )

    mockCreatePayment.mockResolvedValue(
      paymentResponse,
    )

    mockLoadRazorpay.mockResolvedValue(
      FakeRazorpay,
    )

    mockOpenCheckout.mockResolvedValue(
      paymentCredentials,
    )

    mockVerifyPayment.mockResolvedValue(
      verificationResponse,
    )
  })


  // Test 1

  it('initializes with an idle payment state', () => {
    const { result } = setupHook()

    expect(result.current.paymentStage).toBe('idle')
    expect(result.current.paymentBusy).toBe(false)
    expect(result.current.paymentBlocked).toBe(false)
    expect(result.current.paymentError).toBeNull()
    expect(result.current.paymentMessage).toBeNull()

    expect(result.current.paymentButtonLabel)
      .toBe('Proceed to payment')

    expect(mockCreatePayment).not.toHaveBeenCalled()
  })


  // Test 2

  it('successfully creates and verifies a payment', async () => {
    const { result, onSuccess } = setupHook()

    await act(async () => {
      await result.current.handlePayment()
    })

    expect(mockReconcilePayment)
      .toHaveBeenCalledWith(ORDER_ID, ACCESS_TOKEN)

    expect(mockCreatePayment)
      .toHaveBeenCalledWith(ORDER_ID, ACCESS_TOKEN)

    expect(mockOpenCheckout).toHaveBeenCalledTimes(1)

    expect(mockVerifyPayment)
      .toHaveBeenCalledWith(
        paymentCredentials,
        ACCESS_TOKEN,
      )

    expect(result.current.paymentStage).toBe('success')
    expect(result.current.paymentError).toBeNull()
    expect(result.current.paymentBusy).toBe(false)

    expect(result.current.paymentButtonLabel)
      .toBe('Payment completed')

    expect(onSuccess).toHaveBeenCalledTimes(1)
  })


  // Test 3

  it('blocks another payment after checkout dismissal', async () => {
    mockOpenCheckout.mockResolvedValueOnce(null)

    const { result, onSuccess } = setupHook()

    await act(async () => {
      await result.current.handlePayment()
    })

    expect(result.current.paymentStage)
      .toBe('recovery_required')

    expect(result.current.paymentBlocked).toBe(true)

    expect(result.current.paymentMessage)
      .toContain('Checkout closed')

    expect(mockVerifyPayment).not.toHaveBeenCalled()
    expect(onSuccess).not.toHaveBeenCalled()

    await act(async () => {
      await result.current.handlePayment()
    })

    expect(mockCreatePayment).toHaveBeenCalledTimes(1)
    expect(mockOpenCheckout).toHaveBeenCalledTimes(1)

    expect(result.current.paymentError)
      .toContain('Check your previous payment status')
  })


  // Test 4

  it('does not reopen checkout for an existing pending payment', async () => {
    mockReconcilePayment.mockResolvedValueOnce(
      pendingResponse,
    )

    const { result, onSuccess } = setupHook()

    await act(async () => {
      await result.current.handlePayment()
    })

    expect(result.current.paymentStage)
      .toBe('recovery_required')

    expect(result.current.paymentBlocked).toBe(true)

    expect(mockLoadRazorpay).not.toHaveBeenCalled()
    expect(mockCreatePayment).not.toHaveBeenCalled()
    expect(mockOpenCheckout).not.toHaveBeenCalled()
    expect(onSuccess).not.toHaveBeenCalled()
  })


  // Test 5

  it('recognizes an already completed payment', async () => {
    mockReconcilePayment.mockResolvedValueOnce({
      ...recoveredResponse,
      reconciled: false,
    })

    const { result, onSuccess } = setupHook()

    await act(async () => {
      await result.current.handlePayment()
    })

    expect(result.current.paymentStage).toBe('success')

    expect(result.current.paymentMessage)
      .toBe('Your payment has already been confirmed.')

    expect(mockCreatePayment).not.toHaveBeenCalled()
    expect(mockOpenCheckout).not.toHaveBeenCalled()
    expect(mockVerifyPayment).not.toHaveBeenCalled()

    expect(onSuccess).toHaveBeenCalledTimes(1)
  })


  // Test 6

  it('preserves payment credentials when verification fails', async () => {
    mockVerifyPayment.mockRejectedValueOnce(
      new Error('Verification unavailable'),
    )

    const { result, onSuccess } = setupHook()

    await act(async () => {
      await result.current.handlePayment()
    })

    expect(result.current.paymentStage)
      .toBe('verification_pending')

    expect(result.current.paymentError)
      .toBe('Verification unavailable')

    expect(result.current.paymentButtonLabel)
      .toBe('Retry verification')

    expect(result.current.paymentBusy).toBe(false)
    expect(result.current.paymentBlocked).toBe(false)

    expect(onSuccess).not.toHaveBeenCalled()
  })


  // Test 7

  it('retries verification without creating another payment', async () => {
    mockVerifyPayment.mockRejectedValueOnce(
      new Error('Temporary verification failure'),
    )

    const { result, onSuccess } = setupHook()

    await act(async () => {
      await result.current.handlePayment()
    })

    expect(result.current.paymentStage)
      .toBe('verification_pending')

    await act(async () => {
      await result.current.handlePayment()
    })

    expect(mockReconcilePayment).toHaveBeenCalledTimes(1)
    expect(mockCreatePayment).toHaveBeenCalledTimes(1)
    expect(mockOpenCheckout).toHaveBeenCalledTimes(1)
    expect(mockVerifyPayment).toHaveBeenCalledTimes(2)

    expect(mockVerifyPayment)
      .toHaveBeenNthCalledWith(
        2,
        paymentCredentials,
        ACCESS_TOKEN,
      )

    expect(result.current.paymentStage).toBe('success')
    expect(result.current.paymentError).toBeNull()

    expect(onSuccess).toHaveBeenCalledTimes(1)
  })


  // Test 8

  it('recovers a captured payment after verification failure', async () => {
    mockVerifyPayment.mockRejectedValueOnce(
      new Error('Backend unavailable'),
    )

    const { result, onSuccess } = setupHook()

    await act(async () => {
      await result.current.handlePayment()
    })

    expect(result.current.paymentStage)
      .toBe('verification_pending')

    mockReconcilePayment.mockResolvedValueOnce(
      recoveredResponse,
    )

    await act(async () => {
      await result.current.handleReconciliation()
    })

    expect(result.current.paymentStage).toBe('success')

    expect(result.current.paymentMessage)
      .toBe(
        'Payment recovered successfully. Your order is completed.',
      )

    expect(result.current.paymentError).toBeNull()

    expect(mockCreatePayment).toHaveBeenCalledTimes(1)
    expect(mockOpenCheckout).toHaveBeenCalledTimes(1)
    expect(mockVerifyPayment).toHaveBeenCalledTimes(1)

    expect(onSuccess).toHaveBeenCalledTimes(1)
  })


  // Test 9

  it('keeps payment blocked when reconciliation finds no captured payment', async () => {
    mockReconcilePayment.mockResolvedValueOnce(
      pendingResponse,
    )

    const { result, onSuccess } = setupHook()

    await act(async () => {
      await result.current.handleReconciliation()
    })

    expect(result.current.paymentStage)
      .toBe('recovery_required')

    expect(result.current.paymentBlocked).toBe(true)

    expect(result.current.paymentMessage)
      .toContain('Payment is not yet confirmed')

    expect(mockCreatePayment).not.toHaveBeenCalled()
    expect(mockOpenCheckout).not.toHaveBeenCalled()
    expect(onSuccess).not.toHaveBeenCalled()
  })


  // Test 10

  it('fails safely when reconciliation is unavailable', async () => {
    mockReconcilePayment.mockRejectedValueOnce(
      new Error('HTTP 502 Bad Gateway'),
    )

    const { result, onSuccess } = setupHook()

    await act(async () => {
      await result.current.handleReconciliation()
    })

    expect(result.current.paymentStage)
      .toBe('recovery_required')

    expect(result.current.paymentBlocked).toBe(true)
    expect(result.current.paymentBusy).toBe(false)

    expect(result.current.paymentError)
      .toBe('HTTP 502 Bad Gateway')

    expect(mockCreatePayment).not.toHaveBeenCalled()
    expect(mockOpenCheckout).not.toHaveBeenCalled()
    expect(onSuccess).not.toHaveBeenCalled()
  })


  // Test 11

  it('prevents duplicate concurrent payment submissions', async () => {
    const { result, onSuccess } = setupHook()

    await act(async () => {
      await Promise.all([
        result.current.handlePayment(),
        result.current.handlePayment(),
        result.current.handleReconciliation(),
      ])
    })

    expect(mockReconcilePayment).toHaveBeenCalledTimes(1)
    expect(mockCreatePayment).toHaveBeenCalledTimes(1)
    expect(mockOpenCheckout).toHaveBeenCalledTimes(1)
    expect(mockVerifyPayment).toHaveBeenCalledTimes(1)

    expect(result.current.paymentStage).toBe('success')
    expect(onSuccess).toHaveBeenCalledTimes(1)
  })


  // Test 12

  it('unblocks payment when reconciliation confirms no previous attempt', async () => {
    mockReconcilePayment.mockRejectedValueOnce(
      new Error('Temporary network failure'),
    )

    const { result, onSuccess } = setupHook()

    await act(async () => {
      await result.current.handleReconciliation()
    })

    expect(result.current.paymentBlocked).toBe(true)

    await act(async () => {
      await result.current.handleReconciliation()
    })

    expect(result.current.paymentStage).toBe('idle')
    expect(result.current.paymentBlocked).toBe(false)
    expect(result.current.paymentError).toBeNull()

    expect(result.current.paymentMessage)
      .toBe('No previous payment attempt was found.')

    expect(result.current.paymentButtonLabel)
      .toBe('Proceed to payment')

    expect(mockCreatePayment).not.toHaveBeenCalled()
    expect(mockOpenCheckout).not.toHaveBeenCalled()
    expect(onSuccess).not.toHaveBeenCalled()
  })
})