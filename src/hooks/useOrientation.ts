import { useState, useEffect } from 'react'

export type Orientation = 'portrait' | 'landscape'

export function useOrientation(): Orientation {
  const get = (): Orientation =>
    typeof window !== 'undefined' && window.innerWidth > window.innerHeight
      ? 'landscape'
      : 'portrait'

  const [orientation, setOrientation] = useState<Orientation>(get)

  useEffect(() => {
    const handler = () => setOrientation(get())
    window.addEventListener('resize', handler)
    window.addEventListener('orientationchange', handler)
    return () => {
      window.removeEventListener('resize', handler)
      window.removeEventListener('orientationchange', handler)
    }
  }, [])

  return orientation
}
