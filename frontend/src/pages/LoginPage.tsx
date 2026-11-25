
import { useState, type FormEvent } from 'react'
import {
  Link,
  Navigate,
  useLocation,
  useNavigate,
} from 'react-router'

import { useAuth } from '../context/useAuth'

export default function LoginPage() {
  const { user, loading, login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  const requestedPath = location.state?.from?.pathname

  const returnTo =
    typeof requestedPath === 'string' &&
    /^\/checkout\/[1-9]\d*$/.test(requestedPath)
      ? requestedPath
      : '/'

  const [gmail, setGmail] = useState('')
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  if (loading) {
    return (
      <main className="p-8 text-center">
        Loading...
      </main>
    )
  }

  if (user) {
    return <Navigate to={returnTo} replace />
  }

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault()
    setError('')
    setSubmitting(true)

    try {
      await login(gmail.trim(), password)
      navigate(returnTo, { replace: true })
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Login failed',
      )
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <main className="mx-auto max-w-md px-4 py-16">
      <h1 className="mb-3 text-3xl font-bold">
        Welcome back
      </h1>

      <p className="mb-8 text-muted">
        {returnTo !== '/'
          ? 'Sign in to continue your purchase.'
          : 'Sign in to your Sellora account.'}
      </p>

      <form
        onSubmit={handleSubmit}
        className="space-y-5"
      >
        <div>
          <label
            htmlFor="gmail"
            className="mb-2 block font-medium"
          >
            Email
          </label>

          <input
            id="gmail"
            type="email"
            required
            autoComplete="email"
            value={gmail}
            onChange={(event) =>
              setGmail(event.target.value)
            }
            className="w-full rounded-lg border border-outline bg-surface px-4 py-3"
          />
        </div>

        <div>
          <label
            htmlFor="password"
            className="mb-2 block font-medium"
          >
            Password
          </label>

          <input
            id="password"
            type="password"
            required
            autoComplete="current-password"
            value={password}
            onChange={(event) =>
              setPassword(event.target.value)
            }
            className="w-full rounded-lg border border-outline bg-surface px-4 py-3"
          />
        </div>

        {error && (
          <p role="alert" className="text-sm text-red-500">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-lg bg-brand px-5 py-3 font-semibold text-white disabled:opacity-50"
        >
          {submitting ? 'Signing in...' : 'Sign in'}
        </button>
      </form>

      <p className="mt-6 text-center text-sm">
        New to Sellora?{' '}
        <Link
          to="/register"
          className="font-semibold text-brand underline"
        >
          Create an account
        </Link>
      </p>
    </main>
  )
}