import { useState, useEffect } from 'react'
import { readLayoutViewportSize } from '../lib/viewportLayoutMetrics'

export type Orientation = 'portrait' | 'landscape'

export function useOrientation(): Orientation {
  const get = (): Orientation => {
    if (typeof window === 'undefined') return 'portrait'
    const { width, height } = readLayoutViewportSize()
    return width > height ? 'landscape' : 'portrait'
  }

  const [orientation, setOrientation] = useState<Orientation>(get)

  useEffect(() => {
    const handler = () => {
      /** 回転直後は innerWidth/Height が未更新のことがある */
      requestAnimationFrame(() => setOrientation(get()))
    }
    window.addEventListener('resize', handler)
    window.addEventListener('orientationchange', handler)
    return () => {
      window.removeEventListener('resize', handler)
      window.removeEventListener('orientationchange', handler)
    }
  }, [])

  return orientation
}
