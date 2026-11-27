
import { useRef, useState } from 'react'

import {
  createPayment,
  verifyPayment,
  reconcilePayment,
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
  | 'recovery_required'
  | 'reconciling'
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
  const recoveryRequiredRef = useRef(false)

  function completePayment(message: string) {
    paymentSucceededRef.current = true
    recoveryRequiredRef.current = false
    paymentCredentialsRef.current = null

    setPaymentStage('success')
    setPaymentError(null)
    setPaymentMessage(message)
  }

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

    if (
      recoveryRequiredRef.current &&
      !paymentCredentialsRef.current
    ) {
      setPaymentError(
        'Check your previous payment status before attempting another payment.',
      )
      return
    }

    paymentSubmissionRef.current = true

    setPaymentError(null)
    setPaymentMessage(null)

    let credentials = paymentCredentialsRef.current

    try {
      if (!credentials) {
        setPaymentStage('initializing')

        const accessToken = await getAccessToken()

        if (!accessToken) {
          throw new Error(
            'Unable to authenticate your session.',
          )
        }

        const existingPayment = await reconcilePayment(
          orderId,
          accessToken,
        )

        if (existingPayment.order_id !== orderId) {
          throw new Error(
            'Payment response does not match this order.',
          )
        }

        if (
          existingPayment.payment_status === 'SUCCESS' &&
          existingPayment.order_status === 'COMPLETED'
        ) {
          completePayment(
            'Your payment has already been confirmed.',
          )
          onSuccess()
          return
        }

        if (
          existingPayment.payment_status !== 'NOT_INITIATED'
        ) {
          recoveryRequiredRef.current = true

          setPaymentStage('recovery_required')

          setPaymentMessage(
            'A previous payment attempt exists. Check its status before making another payment.',
          )

          return
        }

        const Razorpay = await loadRazorpay()

        recoveryRequiredRef.current = true

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
          setPaymentStage('recovery_required')

          setPaymentMessage(
            'Checkout closed. Check your payment status before attempting another payment.',
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

      completePayment(
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
          : recoveryRequiredRef.current
            ? 'recovery_required'
            : 'idle',
      )

      return
    } finally {
      paymentSubmissionRef.current = false
    }

    onSuccess()
  }

  async function handleReconciliation() {
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
    setPaymentStage('reconciling')

    let completed = false

    try {
      const accessToken = await getAccessToken()

      if (!accessToken) {
        throw new Error(
          'Unable to authenticate your session.',
        )
      }

      const result = await reconcilePayment(
        orderId,
        accessToken,
      )

      if (result.order_id !== orderId) {
        throw new Error(
          'Payment response does not match this order.',
        )
      }

      if (
        result.payment_status === 'SUCCESS' &&
        result.order_status === 'COMPLETED'
      ) {
        completePayment(
          result.reconciled
            ? 'Payment recovered successfully. Your order is completed.'
            : 'Your payment has already been confirmed.',
        )

        completed = true
      } else if (
        result.payment_status === 'NOT_INITIATED' &&
        !paymentCredentialsRef.current
      ) {
        recoveryRequiredRef.current = false

        setPaymentStage('idle')

        setPaymentMessage(
          'No previous payment attempt was found.',
        )
      } else {
        recoveryRequiredRef.current = true

        setPaymentStage(
          paymentCredentialsRef.current
            ? 'verification_pending'
            : 'recovery_required',
        )

        setPaymentMessage(
          'Payment is not yet confirmed. Do not pay again if money has been deducted.',
        )
      }
    } catch (err) {
      recoveryRequiredRef.current = true

      setPaymentError(
        err instanceof Error
          ? err.message
          : 'Unable to check payment status.',
      )

      setPaymentStage(
        paymentCredentialsRef.current
          ? 'verification_pending'
          : 'recovery_required',
      )
    } finally {
      paymentSubmissionRef.current = false
    }

    if (completed) {
      onSuccess()
    }
  }

  const paymentBusy =
    paymentStage === 'initializing' ||
    paymentStage === 'checkout' ||
    paymentStage === 'verifying' ||
    paymentStage === 'reconciling'

  const paymentBlocked =
    paymentStage === 'recovery_required'

  const paymentButtonLabel = {
    idle: 'Proceed to payment',
    initializing: 'Initializing payment...',
    checkout: 'Checkout in progress...',
    verifying: 'Verifying payment...',
    verification_pending: 'Retry verification',
    recovery_required: 'Payment status unresolved',
    reconciling: 'Checking payment status...',
    success: 'Payment completed',
  }[paymentStage]

  return {
    paymentStage,
    paymentError,
    paymentMessage,
    paymentBusy,
    paymentBlocked,
    paymentButtonLabel,
    handlePayment,
    handleReconciliation,
  }
}