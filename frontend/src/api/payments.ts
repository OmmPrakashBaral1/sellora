import { API_BASE_URL, parseResponse } from './client'

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