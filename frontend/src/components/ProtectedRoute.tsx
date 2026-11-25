import { Navigate, Outlet, useLocation } from 'react-router'
import { useAuth } from '../context/useAuth'

type ProtectedRouteProps = {
  allowedRoles?: string[]
}

export default function ProtectedRoute({
  allowedRoles,
}: ProtectedRouteProps) {
  const { user, loading } = useAuth()
  const location = useLocation()

  if (loading) {
    return (
      <div
        role="status"
        className="flex min-h-[50vh] items-center justify-center text-muted"
      >
        Verifying your session...
      </div>
    )
  }

  if (!user) {
    return (
      <Navigate
        to="/login"
        replace
        state={{ from: location }}
      />
    )
  }

  if (
    allowedRoles &&
    !allowedRoles.includes(user.role)
  ) {
    return (
      <div className="mx-auto max-w-xl px-6 py-20 text-center">
        <h1 className="text-2xl font-bold text-foreground">
          Access denied
        </h1>

        <p className="mt-3 text-muted">
          You do not have permission to access this page.
        </p>
      </div>
    )
  }

  return <Outlet />
}