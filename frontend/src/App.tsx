import { Route, Routes } from 'react-router'
import { useParams } from 'react-router'

import Navbar from './components/Navbar'
import ProtectedRoute from './components/ProtectedRoute'

import HomePage from './pages/HomePage'
import ProductsPage from './pages/ProductsPage'
import ProductDetailsPage from './pages/ProductDetailsPage'
import LoginPage from './pages/LoginPage'
import RegisterPage from './pages/RegisterPage'
import CheckoutPage from './pages/CheckoutPage'

function CheckoutRoute() {
  const { productId } = useParams()

  return <CheckoutPage key={productId} />
}

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

        <Route path="/login" element={<LoginPage />} />

        <Route
          path="/register"
          element={<RegisterPage />}
        />

        <Route
          element={
            <ProtectedRoute allowedRoles={['BUYER']} />
          }
        >
          <Route
            path="/checkout/:productId"
            element={<CheckoutRoute />}
          />
        </Route>
      </Routes>
    </>
  )
}