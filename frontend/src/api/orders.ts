import { API_BASE_URL, parseResponse } from './client'

import type {
  OrderCreate,
  OrderCreateResponse,
  BuyerOrder,
  BuyerOrderDetails,
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

export async function getMyOrders(
  accessToken: string,
  signal?: AbortSignal,
): Promise<BuyerOrder[]> {
  const response = await fetch(`${API_BASE_URL}/orders/`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    signal,
  })

  return parseResponse<BuyerOrder[]>(response)
}

export async function getOrderById(
  orderId: number,
  accessToken: string,
  signal?: AbortSignal,
): Promise<BuyerOrderDetails> {
  const response = await fetch(
    `${API_BASE_URL}/orders/${orderId}`,
    {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      signal,
    },
  )

  return parseResponse<BuyerOrderDetails>(response)
}