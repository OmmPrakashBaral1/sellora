import {
  API_BASE_URL,
  parseResponse,
  ensureSuccessfulResponse,
} from './client'

import type {
  OrderCreate,
  OrderCreateResponse,
  BuyerOrder,
  BuyerOrderDetails,
  OrderDownloadsResponse,
  DownloadedFile,
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

export async function getOrderDownloads(
  orderId: number,
  accessToken: string,
  signal?: AbortSignal,
): Promise<OrderDownloadsResponse> {
  const response = await fetch(
    `${API_BASE_URL}/orders/${orderId}/downloads`,
    {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      cache: 'no-store',
      signal,
    },
  )

  return parseResponse<OrderDownloadsResponse>(
    response,
  )
}



export async function downloadPurchasedProduct(
  orderId: number,
  productId: number,
  accessToken: string,
  signal?: AbortSignal,
): Promise<DownloadedFile> {
  const response = await fetch(
    `${API_BASE_URL}/orders/${orderId}/downloads/${productId}`,
    {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      cache: 'no-store',
      signal,
    },
  )

  await ensureSuccessfulResponse(response)

  const blob = await response.blob()

  const disposition = response.headers.get(
    'content-disposition',
  )

  const filenameMatch = disposition?.match(
    /filename="?([^";]+)"?/i,
  )

  const serverFilename = filenameMatch?.[1]?.trim()

  const expectedFilenamePattern = new RegExp(
    `^sellora-product-${productId}\\.(zip|pdf|png|jpg|jpeg|mp3|mp4)$`,
  )

  const extensionByMimeType: Record<string, string> = {
    'application/zip': 'zip',
    'application/x-zip-compressed': 'zip',
    'application/pdf': 'pdf',
    'image/png': 'png',
    'image/jpeg': 'jpg',
    'audio/mpeg': 'mp3',
    'video/mp4': 'mp4',
  }

  const mimeType = blob.type
    .split(';')[0]
    .trim()
    .toLowerCase()

  const fallbackExtension = extensionByMimeType[mimeType]

  const fallbackFilename = fallbackExtension
    ? `sellora-product-${productId}.${fallbackExtension}`
    : `sellora-product-${productId}`

  const filename =
    serverFilename &&
      expectedFilenamePattern.test(serverFilename)
      ? serverFilename
      : fallbackFilename

  return {
    blob,
    filename,
  }
}