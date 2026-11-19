
import { Route, Routes } from 'react-router'

import Navbar from './components/Navbar'
import HomePage from './pages/HomePage'
import ProductsPage from './pages/ProductsPage'
import ProductDetailsPage from './pages/ProductDetailsPage'

export default function App() {
  return (
    <>
      <Navbar />

      <Routes>
        <Route path="/" element={<HomePage />} />

        <Route
          path="/products"
          element={<ProductsPage />}
        />

        <Route
          path="/products/:productId"
          element={<ProductDetailsPage />}
        />
      </Routes>
    </>
  )
}
