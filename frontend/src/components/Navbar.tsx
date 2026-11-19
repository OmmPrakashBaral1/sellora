import { Link, NavLink, useLocation } from 'react-router'
import { useEffect } from 'react'

import { useTheme } from '../context/ThemeContext'
import ThemeToggle from './ThemeToggle'

export default function Navbar() {
  const { theme } = useTheme()
  const { pathname } = useLocation()

  const logo =
    theme === 'dark'
      ? '/branding/sellora_logo_dark.png'
      : '/branding/sellora_logo_light.png'

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' })
  }, [pathname])

  function handleLogoClick() {
    if (pathname === '/') {
      window.scrollTo({ top: 0, behavior: 'smooth' })
    }
  }

  return (
    <header className="sticky top-0 z-50 border-b border-outline bg-surface">
      <nav
        aria-label="Main navigation"
        className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-6 py-4"
      >
        <Link
          to="/"
          aria-label="Sellora homepage"
          onClick={handleLogoClick}
        >
          <img
            src={logo}
            alt="Sellora"
            className="h-10 w-auto max-w-[160px] object-contain"
          />
        </Link>

        <div className="flex items-center gap-5">
          <NavLink
            to="/"
            end
            className={({ isActive }) =>
              isActive
                ? 'font-semibold text-brand'
                : 'text-muted hover:text-foreground'
            }
          >
            Home
          </NavLink>

          <NavLink
            to="/products"
            className={({ isActive }) =>
              isActive
                ? 'font-semibold text-brand'
                : 'text-muted hover:text-foreground'
            }
          >
            Explore
          </NavLink>

          <ThemeToggle />
        </div>
      </nav>
    </header>
  )
}