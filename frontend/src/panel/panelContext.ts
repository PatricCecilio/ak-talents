import type { ReactNode } from 'react'
import { useEffect } from 'react'
import { useOutletContext } from 'react-router-dom'

export interface PanelContext {
  /** Buttons shown at the right of the top bar ("+ Nova vaga", "Copiar link da vaga"...). */
  setActions: (actions: ReactNode) => void
  /** Ask the sidebar to refresh the "to triage" count after something changed. */
  refreshCounts: () => void
}

export function usePanel(): PanelContext {
  return useOutletContext<PanelContext>()
}

/** Sets the top bar buttons of the current page (cleared when the page unmounts). */
export function usePanelActions(actions: ReactNode, deps: unknown[]) {
  const { setActions } = usePanel()
  useEffect(() => {
    setActions(actions)
    return () => setActions(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- the caller lists what the buttons depend on
  }, deps)
}
