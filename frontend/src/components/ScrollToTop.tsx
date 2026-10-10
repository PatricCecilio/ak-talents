import { useLayoutEffect } from 'react'
import { useLocation } from 'react-router-dom'

// A new page starts at the top (the router keeps the previous scroll position otherwise, e.g. after signing up
// on a phone). Links to a section (#como-funciona) keep the browser's own scrolling.
export function ScrollToTop() {
  const { pathname, hash } = useLocation()

  useLayoutEffect(() => {
    if (!hash) window.scrollTo(0, 0)
  }, [pathname, hash])

  return null
}
