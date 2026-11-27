export type PaymentCreateResponse = {
  message: string
  payment_id: number
  razorpay_key_id: string
  razorpay_order_id: string
  amount: number
  currency: string
}

export type PaymentVerifyRequest = {
  razorpay_order_id: string
  razorpay_payment_id: string
  razorpay_signature: string
}

export type PaymentVerifyResponse =
  | {
      message: string
      payment_id: number
      status: 'SUCCESS'
    }
  | {
      message: string
      payment_id: number
      order_id: number
      payment_status: 'SUCCESS'
      order_status: 'COMPLETED'
      completed_seller_orders: number
    }

export type PaymentReconcileResponse =
  | {
      message: string
      order_id: number
      payment_id: number
      order_status: 'COMPLETED'
      payment_status: 'SUCCESS'
      reconciled: boolean
    }
  | {
      message: string
      order_id: number
      order_status: 'PENDING'
      payment_status: 'PENDING' | 'NOT_INITIATED'
      reconciled: false
    }