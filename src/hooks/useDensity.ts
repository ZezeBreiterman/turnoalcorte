import { useEffect } from 'react'
import { useUIStore, type Density } from '@/store/ui.store'

export function useDensity() {
  const { density, setDensity } = useUIStore()

  useEffect(() => {
    document.documentElement.setAttribute('data-density', density)
  }, [density])

  const toggle = () => setDensity(density === 'cozy' ? 'compact' : 'cozy')

  return { density, setDensity, toggle }
}

export type { Density }
