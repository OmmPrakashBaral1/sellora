
import { useEffect } from 'react'
import { Link, NavLink, useLocation } from 'react-router'

import { useTheme } from '../context/useTheme'
import ThemeToggle from './ThemeToggle'

export default function Navbar() {
  const { theme } = useTheme()
  const { pathname } = useLocation()

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
        bg-surface/95
        backdrop-blur-xl
      "
    >
      <nav
        aria-label="Main navigation"
        className="
          mx-auto flex min-h-20 max-w-7xl
          items-center justify-between
          gap-3 px-4 py-3
          sm:px-6 lg:px-8
        "
      >
        <Link
          to="/"
          aria-label="Sellora homepage"
          onClick={handleLogoClick}
          className="
            flex shrink-0 items-center
            rounded-md
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
              object-contain
              sm:w-36
            "
          />
        </Link>

        <div className="flex items-center gap-2 sm:gap-4">
          <div
            className="
              flex items-center gap-1
              rounded-full
              border border-outline
              bg-page/80
              p-1
            "
          >
            <NavLink
              to="/"
              end
              className={navLinkClass}
            >
              Home
            </NavLink>

            <NavLink
              to="/products"
              className={navLinkClass}
            >
              Explore
            </NavLink>
          </div>

          <ThemeToggle />
        </div>
      </nav>
    </header>
  )
}
