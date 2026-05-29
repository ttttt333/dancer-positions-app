import { useState, useEffect } from 'react'

export type Orientation = 'portrait' | 'landscape'

export function useOrientation(): Orientation {
  const get = (): Orientation =>
    typeof window !== 'undefined' && window.innerWidth > window.innerHeight
      ? 'landscape'
      : 'portrait'

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
