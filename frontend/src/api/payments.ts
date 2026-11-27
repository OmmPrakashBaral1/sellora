import { API_BASE_URL, parseResponse } from './client'
import type { PaymentReconcileResponse } from '../types/payment'

import type {
  PaymentCreateResponse,
  PaymentVerifyRequest,
  PaymentVerifyResponse,
} from '../types/payment'

export async function createPayment(
  orderId: number,
  accessToken: string,
): Promise<PaymentCreateResponse> {
  const response = await fetch(
    `${API_BASE_URL}/payments/create/${orderId}`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
  )

  return parseResponse<PaymentCreateResponse>(response)
}

export async function verifyPayment(
  paymentData: PaymentVerifyRequest,
  accessToken: string,
): Promise<PaymentVerifyResponse> {
  const response = await fetch(
    `${API_BASE_URL}/payments/verify`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify(paymentData),
    },
  )

  return parseResponse<PaymentVerifyResponse>(response)
}

export async function reconcilePayment(
  orderId: number,
  accessToken: string,
): Promise<PaymentReconcileResponse> {
  const response = await fetch(
    `${API_BASE_URL}/payments/reconcile/${orderId}`,
    {
      method: 'POST',

      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
  )

  return parseResponse<PaymentReconcileResponse>(
    response,
  )
}