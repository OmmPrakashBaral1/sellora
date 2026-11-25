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

export type OrderItem = {
  product_id: number
  title: string
  thumbnail_url: string
  price_at_purchase: string
  quantity: number
}

export type BuyerOrder = {
  order_id: number
  total_amount: string
  status: string
  created_at: string | null
  items: OrderItem[]
}

export type BuyerOrderDetails = BuyerOrder & {
  buyer_id: number
}