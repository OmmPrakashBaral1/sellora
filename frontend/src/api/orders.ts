import { API_BASE_URL, parseResponse } from './client'

import type {
  OrderCreate,
  OrderCreateResponse,
} from '../types/order'

export async function createOrder(
  orderData: OrderCreate,
  accessToken: string,
): Promise<OrderCreateResponse> {
  const response = await fetch(`${API_BASE_URL}/orders/`, {
    method: 'POST',

    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },

    body: JSON.stringify(orderData),
  })

  return parseResponse<OrderCreateResponse>(response)
}