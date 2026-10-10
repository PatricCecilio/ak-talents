import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { APPINTELLI_VISIBILITY_ATTRIBUTE, isCommercialPath } from '../services/appIntelliRoutes'
import { installAppIntelliWidget } from '../services/appIntelliWidgetLoader'

// Loads the AppIntelli widget only on commercial pages. Navigating away without a reload (home → /vagas) closes
// the chat and hides the widget's elements via index.css; coming back shows them again.
export function AppIntelliRouteGate() {
  const { pathname } = useLocation()
  const commercial = isCommercialPath(pathname)

  useEffect(() => {
    document.documentElement.setAttribute(APPINTELLI_VISIBILITY_ATTRIBUTE, commercial ? 'on' : 'off')
    if (commercial) {
      installAppIntelliWidget()
      return
    }
    try {
      window.AppIntelli?.close()
    } catch {
      // The widget is third-party code; hiding it via CSS is enough.
    }
  }, [commercial])

  return null
}
