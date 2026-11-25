export const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ?? '/api'

export class ApiError extends Error {
  status: number

  constructor(status: number, message: string) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

export async function parseResponse<T>(
  response: Response,
): Promise<T> {
  if (!response.ok) {
    const body: unknown = await response
      .json()
      .catch(() => null)

    let message = `Request failed (${response.status})`

    if (
      typeof body === 'object' &&
      body !== null &&
      'detail' in body &&
      typeof body.detail === 'string'
    ) {
      message = body.detail
    }

    throw new ApiError(response.status, message)
  }

  return response.json() as Promise<T>
}