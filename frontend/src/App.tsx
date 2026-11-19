
import { Link, Route, Routes } from 'react-router'

import Navbar from './components/Navbar'
import ProductsPage from './pages/ProductsPage'

function HomePage() {
  return (
    <main className="min-h-screen bg-page text-foreground">
      <div className="mx-auto max-w-7xl px-6 py-20">
        <p className="mb-5 text-sm font-semibold uppercase tracking-widest text-brand">
          The Creator Marketplace
        </p>

        <h1 className="max-w-3xl text-5xl font-extrabold leading-tight md:text-6xl">
          Ideas deserve extraordinary tools.
        </h1>

        <p className="mt-6 max-w-2xl text-lg text-muted">
          Discover premium digital products from independent creators.
          Find the tools to bring your next idea to life.
        </p>

        <Link
          to="/products"
          className="mt-9 inline-block rounded-lg bg-brand px-7 py-3 font-semibold text-brand-foreground transition hover:opacity-90"
        >
          Explore Products
        </Link>
      </div>
    </main>
  )
}

export default function App() {
  return (
    <>
      <Navbar />

      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/products" element={<ProductsPage />} />
      </Routes>
    </>
  )
}
