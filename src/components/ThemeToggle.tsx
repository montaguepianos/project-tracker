import { Moon, Sun } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { useThemeStore } from '@/store/themeStore'

export function ThemeToggle() {
  const theme = useThemeStore((state) => state.theme)
  const toggleTheme = useThemeStore((state) => state.toggleTheme)

  const nextLabel = theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'

  return (
    <Button
      type="button"
      variant="outline"
      size="icon"
      aria-label={nextLabel}
      onClick={toggleTheme}
      className="shrink-0"
    >
      {theme === 'light' ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
    </Button>
  )
}
