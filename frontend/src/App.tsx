import { Link, Route, Routes } from 'react-router'
import ProductsPage from './pages/ProductsPage'

function HomePage() {
  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <div className="mx-auto max-w-6xl px-6 py-20">
        <h1 className="text-5xl font-bold">
          Welcome to Sellora
        </h1>

        <p className="mt-5 text-lg text-slate-300">
          Discover premium digital products from independent creators.
        </p>

        <Link
          to="/products"
          className="mt-8 inline-block rounded-lg bg-indigo-600 px-6 py-3 font-semibold hover:bg-indigo-500"
        >
          Explore Products
        </Link>
      </div>
    </main>
  )
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/products" element={<ProductsPage />} />
    </Routes>
  )
}