import { useEffect } from 'react'

import { useUiStore } from '@/stores/ui'

/**
 * Applies the theme to <html>.
 *
 * `system` follows the OS and keeps following it, so a user who flips their
 * desktop to dark at sunset does not have to touch the app.
 */
export function useThemeEffect(): void {
  const theme = useUiStore((state) => state.theme)

  useEffect(() => {
    const root = document.documentElement
    const media = window.matchMedia('(prefers-color-scheme: dark)')

    const apply = () => {
      const dark = theme === 'dark' || (theme === 'system' && media.matches)
      root.classList.toggle('dark', dark)
      root.style.colorScheme = dark ? 'dark' : 'light'
    }

    apply()
    if (theme !== 'system') return
    media.addEventListener('change', apply)
    return () => media.removeEventListener('change', apply)
  }, [theme])
}
