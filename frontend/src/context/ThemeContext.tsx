import {
  useEffect,
  useState,
  type ReactNode,
} from 'react'

import {
  ThemeContext,
  type Theme,
} from './theme-context'

function getInitialTheme(): Theme {
  try {
    const savedTheme = localStorage.getItem('sellora-theme')

    if (savedTheme === 'light' || savedTheme === 'dark') {
      return savedTheme
    }
  } catch {
    // Continue with system preference if storage is unavailable.
  }

  return window.matchMedia('(prefers-color-scheme: dark)').matches
    ? 'dark'
    : 'light'
}

export function ThemeProvider({
  children,
}: {
  children: ReactNode
}) {
  const [theme, setTheme] = useState<Theme>(getInitialTheme)

  useEffect(() => {
    document.documentElement.dataset.theme = theme

    try {
      localStorage.setItem('sellora-theme', theme)
    } catch {
      // Theme switching works even without localStorage.
    }
  }, [theme])

  function toggleTheme() {
    setTheme((current) =>
      current === 'light' ? 'dark' : 'light'
    )
  }

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}