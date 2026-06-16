import { useCallback, useState } from 'react'

export function useFormState<T extends Record<string, string>>(initialState: T) {
  const [values, setValues] = useState(initialState)

  const updateField = useCallback((field: keyof T, value: string) => {
    setValues((currentValues) => ({
      ...currentValues,
      [field]: value,
    }))
  }, [])

  const reset = useCallback(() => {
    setValues(initialState)
  }, [initialState])

  const setFormValues = useCallback((nextValues: T) => {
    setValues(nextValues)
  }, [])

  return {
    values,
    updateField,
    reset,
    setFormValues,
  }
}
