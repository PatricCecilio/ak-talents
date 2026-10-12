import { Input } from './ui'

interface FormFieldProps {
  id: string
  label: string
  type?: string
  value: string
  placeholder: string
  autoComplete?: string
  inputMode?: 'text' | 'email' | 'tel' | 'url' | 'numeric' | 'decimal'
  required?: boolean
  /** Shown under the field, in Portuguese. */
  error?: string
  onChange: (value: string) => void
}

export function FormField({
  id,
  label,
  type = 'text',
  value,
  placeholder,
  autoComplete,
  inputMode,
  required = true,
  error,
  onChange,
}: FormFieldProps) {
  return (
    <Input
      id={id}
      name={id}
      label={label}
      type={type}
      value={value}
      placeholder={placeholder}
      autoComplete={autoComplete}
      inputMode={inputMode}
      onChange={(event) => onChange(event.target.value)}
      required={required}
      error={error}
    />
  )
}
