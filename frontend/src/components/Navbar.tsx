import { useEffect, useState } from 'react'
import {
  Link,
  NavLink,
  useLocation,
  useNavigate,
} from 'react-router'

import { useTheme } from '../context/useTheme'
import { useAuth } from '../context/useAuth'
import ThemeToggle from './ThemeToggle'

export default function Navbar() {
  const { theme } = useTheme()
  const { user, loading, logout } = useAuth()
  const { pathname } = useLocation()
  const navigate = useNavigate()

  const [loggingOut, setLoggingOut] = useState(false)
  const [logoutError, setLogoutError] = useState('')

  const logo =
    theme === 'dark'
      ? '/branding/sellora_logo_dark.png'
      : '/branding/sellora_logo_light.png'

  useEffect(() => {
    window.scrollTo({
      top: 0,
      left: 0,
      behavior: 'instant',
    })
  }, [pathname])

  function handleLogoClick() {
    if (pathname === '/') {
      window.scrollTo({
        top: 0,
        behavior: 'smooth',
      })
    }
  }

  async function handleLogout() {
    if (loggingOut) return

    setLoggingOut(true)
    setLogoutError('')

    try {
      await logout()
      navigate('/login', { replace: true })
    } catch (error) {
      setLogoutError(
        error instanceof Error
          ? error.message
          : 'Unable to log out. Please try again.',
      )
    } finally {
      setLoggingOut(false)
    }
  }

  const navLinkClass = ({ isActive }: { isActive: boolean }) =>
    [
      'rounded-full px-3 py-2 text-sm font-semibold',
      'transition-colors duration-200',
      'focus-visible:outline-2',
      'focus-visible:outline-offset-2',
      'focus-visible:outline-brand',
      isActive
        ? 'bg-accent text-brand'
        : 'text-muted hover:bg-accent hover:text-foreground',
    ].join(' ')

  return (
    <header
      className="
        sticky top-0 z-50
        border-b border-outline
        bg-surface/95 backdrop-blur-xl
      "
    >
      <nav
        aria-label="Main navigation"
        className="
          mx-auto flex min-h-20 max-w-7xl
          flex-wrap items-center justify-between
          gap-3 px-4 py-3
          sm:px-6 lg:px-8
        "
      >
        <Link
          to="/"
          aria-label="Sellora homepage"
          onClick={handleLogoClick}
          className="
            flex shrink-0 items-center rounded-md
            focus-visible:outline-2
            focus-visible:outline-offset-2
            focus-visible:outline-brand
          "
        >
          <img
            src={logo}
            alt="Sellora"
            className="
              block h-auto w-28
              object-contain sm:w-36
            "
          />
        </Link>

        <div className="flex flex-wrap items-center gap-2 sm:gap-4">
          <div
            className="
              flex items-center gap-1 rounded-full
              border border-outline bg-page/80 p-1
            "
          >
            <NavLink to="/" end className={navLinkClass}>
              Home
            </NavLink>

            <NavLink to="/products" className={navLinkClass}>
              Explore
            </NavLink>
            {!loading && user?.role === 'BUYER' && (
              <NavLink to="/orders" className={navLinkClass}>
                My Orders
              </NavLink>
            )}
          </div>

          {loading ? (
            <span
              role="status"
              className="px-3 text-sm text-muted"
            >
              Loading...
            </span>
          ) : user ? (
            <div className="flex items-center gap-3">
              <div className="hidden text-right sm:block">
                <p className="max-w-36 truncate text-sm font-semibold text-foreground">
                  {user.name}
                </p>

                <p className="text-xs capitalize text-muted">
                  {user.role.toLowerCase()}
                </p>
              </div>

              <button
                type="button"
                onClick={handleLogout}
                disabled={loggingOut}
                className="
                  rounded-full border border-outline
                  px-4 py-2 text-sm font-semibold
                  text-foreground transition-colors
                  hover:bg-accent
                  disabled:cursor-not-allowed
                  disabled:opacity-50
                  focus-visible:outline-2
                  focus-visible:outline-brand
                "
              >
                {loggingOut ? 'Logging out...' : 'Log out'}
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <NavLink
                to="/login"
                className={navLinkClass}
              >
                Log in
              </NavLink>

              <Link
                to="/register"
                className="
                  rounded-full bg-brand px-4 py-2
                  text-sm font-semibold text-white
                  transition-opacity hover:opacity-90
                  focus-visible:outline-2
                  focus-visible:outline-offset-2
                  focus-visible:outline-brand
                "
              >
                Sign up
              </Link>
            </div>
          )}

          <ThemeToggle />
        </div>
      </nav>

      {logoutError && (
        <p
          role="alert"
          className="
            mx-auto max-w-7xl px-4 pb-3
            text-right text-sm text-red-500
          "
        >
          {logoutError}
        </p>
      )}
    </header>
  )
}