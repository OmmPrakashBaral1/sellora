
import { Moon, Sun } from 'lucide-react'
import { useTheme } from '../context/useTheme'

export default function ThemeToggle() {
  const { theme, toggleTheme } = useTheme()

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={
        theme === 'light'
          ? 'Switch to dark mode'
          : 'Switch to light mode'
      }
      title={theme === 'light' ? 'Dark mode' : 'Light mode'}
      aria-pressed={theme === 'dark'}
      className="
        grid
        h-10
        w-10
        min-h-10
        min-w-10
        shrink-0
        place-items-center
        rounded-full
        border
        border-outline
        bg-surface
        p-0
        leading-none
        text-foreground
        transition-colors
        hover:bg-page
        focus-visible:outline-2
        focus-visible:outline-offset-2
        focus-visible:outline-brand
      "
    >
      {theme === 'light' ? (
        <Moon
          className="block h-5 w-5 shrink-0"
          strokeWidth={1.8}
          aria-hidden="true"
        />
      ) : (
        <Sun
          className="block h-5 w-5 shrink-0"
          strokeWidth={1.8}
          aria-hidden="true"
        />
      )}
    </button>
  )
}
