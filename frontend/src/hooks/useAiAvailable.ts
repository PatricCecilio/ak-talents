import { useEffect, useState } from 'react'
import { getAiStatus } from '../services/aiService'

/** Whether the AI assistant can be used (OPENAI_API_KEY configured). False until the API says otherwise. */
export function useAiAvailable(): boolean {
  const [available, setAvailable] = useState(false)

  useEffect(() => {
    let active = true
    getAiStatus()
      .then((status) => {
        if (active) setAvailable(status.available)
      })
      .catch(() => {
        // Unknown counts as unavailable: never offer a button that would fail.
      })
    return () => {
      active = false
    }
  }, [])

  return available
}
