export type OrderItemCreate = {
  product_id: number
  quantity: number
}

export type OrderCreate = {
  items: OrderItemCreate[]
}

export type SellerOrderSummary = {
  seller_order_id: number
  seller_id: number
  subtotal: string
  commission: string
  seller_earning: string
}

export type OrderCreateResponse = {
  message: string
  order_id: number
  buyer_id: number
  total_amount: string
  status: string
  seller_orders: SellerOrderSummary[]
}