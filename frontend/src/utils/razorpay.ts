
import type {
  PaymentVerifyRequest,
} from '../types/payment'

export type RazorpayOptions = {
  key: string
  amount: number
  currency: string
  name: string
  description: string
  order_id: string

  prefill?: {
    name?: string
    email?: string
  }

  theme?: {
    color: string
  }

  handler: (response: PaymentVerifyRequest) => void

  modal?: {
    ondismiss: () => void
  }
}

type RazorpayInstance = {
  open: () => void
  close: () => void
}

type RazorpayConstructor = new (
  options: RazorpayOptions,
) => RazorpayInstance

declare global {
  interface Window {
    Razorpay?: RazorpayConstructor
  }
}

let sdkPromise: Promise<RazorpayConstructor> | null = null

export function loadRazorpay(): Promise<RazorpayConstructor> {
  if (window.Razorpay) {
    return Promise.resolve(window.Razorpay)
  }

  if (sdkPromise) {
    return sdkPromise
  }

  sdkPromise = new Promise<RazorpayConstructor>(
    (resolve, reject) => {
      const script = document.createElement('script')

      script.src =
        'https://checkout.razorpay.com/v1/checkout.js'

      script.async = true

      script.onload = () => {
        if (window.Razorpay) {
          resolve(window.Razorpay)
        } else {
          script.remove()

          reject(
            new Error('Razorpay SDK is unavailable.'),
          )
        }
      }

      script.onerror = () => {
        script.remove()

        reject(
          new Error('Unable to load Razorpay Checkout.'),
        )
      }

      document.head.appendChild(script)
    },
  ).catch((error: unknown) => {
    sdkPromise = null
    throw error
  })

  return sdkPromise
}

export function openRazorpayCheckout(
  Razorpay: RazorpayConstructor,
  options: Omit<RazorpayOptions, 'handler' | 'modal'>,
): Promise<PaymentVerifyRequest | null> {
  return new Promise((resolve, reject) => {
    try {
      const checkout = new Razorpay({
        ...options,

        handler: (response) => {
          resolve(response)
        },

        modal: {
          ondismiss: () => {
            resolve(null)
          },
        },
      })

      checkout.open()
    } catch (error) {
      reject(error)
    }
  })
}