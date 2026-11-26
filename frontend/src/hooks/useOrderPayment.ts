import { useRef, useState } from 'react'

import {
  createPayment,
  verifyPayment,
} from '../api/payments'

import {
  loadRazorpay,
  openRazorpayCheckout,
} from '../utils/razorpay'

import { useAuth } from '../context/useAuth'

import type {
  PaymentVerifyRequest,
} from '../types/payment'

export type PaymentStage =
  | 'idle'
  | 'initializing'
  | 'checkout'
  | 'verifying'
  | 'verification_pending'
  | 'success'

type UseOrderPaymentOptions = {
  orderId: number | null
  orderStatus: string | null
  onSuccess: () => void
}

export function useOrderPayment({
  orderId,
  orderStatus,
  onSuccess,
}: UseOrderPaymentOptions) {
  const { user, getAccessToken } = useAuth()

  const [paymentStage, setPaymentStage] =
    useState<PaymentStage>('idle')

  const [paymentError, setPaymentError] =
    useState<string | null>(null)

  const [paymentMessage, setPaymentMessage] =
    useState<string | null>(null)

  const paymentCredentialsRef =
    useRef<PaymentVerifyRequest | null>(null)

  const paymentSubmissionRef = useRef(false)

  const paymentSucceededRef = useRef(false)

  async function handlePayment() {
    if (
      orderId === null ||
      orderStatus !== 'PENDING' ||
      !user ||
      paymentSubmissionRef.current ||
      paymentSucceededRef.current
    ) {
      return
    }

    paymentSubmissionRef.current = true

    setPaymentError(null)
    setPaymentMessage(null)

    let credentials = paymentCredentialsRef.current

    try {
      if (!credentials) {
        setPaymentStage('initializing')

        const Razorpay = await loadRazorpay()

        const accessToken = await getAccessToken()

        if (!accessToken) {
          throw new Error(
            'Unable to authenticate your session.',
          )
        }

        const payment = await createPayment(
          orderId,
          accessToken,
        )

        setPaymentStage('checkout')

        credentials = await openRazorpayCheckout(
          Razorpay,
          {
            key: payment.razorpay_key_id,
            amount: payment.amount,
            currency: payment.currency,
            order_id: payment.razorpay_order_id,

            name: 'Sellora',
            description: `Order #${orderId}`,

            prefill: {
              name: user.name,
              email: user.gmail,
            },

            theme: {
              color: '#2563eb',
            },
          },
        )

        if (!credentials) {
          setPaymentStage('idle')

          setPaymentMessage(
            'Checkout closed. If money was deducted, check your payment status before trying again.',
          )

          return
        }

        paymentCredentialsRef.current = credentials
      }

      setPaymentStage('verifying')

      const verificationToken = await getAccessToken()

      if (!verificationToken) {
        throw new Error(
          'Your session could not be authenticated for payment verification.',
        )
      }

      const result = await verifyPayment(
        credentials,
        verificationToken,
      )

      const verified =
        'payment_status' in result
          ? result.payment_status === 'SUCCESS' &&
            result.order_status === 'COMPLETED'
          : result.status === 'SUCCESS'

      if (!verified) {
        throw new Error(
          'Payment confirmation is still pending.',
        )
      }

      paymentSucceededRef.current = true
      paymentCredentialsRef.current = null

      setPaymentStage('success')

      setPaymentMessage(
        'Payment verified successfully. Your order is completed.',
      )
    } catch (err) {
      setPaymentError(
        err instanceof Error
          ? err.message
          : 'Unable to complete payment.',
      )

      setPaymentStage(
        credentials
          ? 'verification_pending'
          : 'idle',
      )

      return
    } finally {
      paymentSubmissionRef.current = false
    }

    onSuccess()
  }

  const paymentBusy =
    paymentStage === 'initializing' ||
    paymentStage === 'checkout' ||
    paymentStage === 'verifying'

  const paymentButtonLabel = {
    idle: 'Proceed to payment',
    initializing: 'Initializing payment...',
    checkout: 'Checkout in progress...',
    verifying: 'Verifying payment...',
    verification_pending: 'Retry verification',
    success: 'Payment completed',
  }[paymentStage]

  return {
    paymentStage,
    paymentError,
    paymentMessage,
    paymentBusy,
    paymentButtonLabel,
    handlePayment,
  }
}