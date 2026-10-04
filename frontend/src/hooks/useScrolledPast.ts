import { useEffect, useState } from 'react'

/** True once the window has scrolled more than `offset` pixels. */
export function useScrolledPast(offset: number) {
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const update = () => setScrolled(window.scrollY > offset)
    update()
    window.addEventListener('scroll', update, { passive: true })
    return () => window.removeEventListener('scroll', update)
  }, [offset])

  return scrolled
}
