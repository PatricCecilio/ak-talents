import { Input } from './ui'

interface FormFieldProps {
  id: string
  label: string
  type?: string
  value: string
  placeholder: string
  autoComplete?: string
  onChange: (value: string) => void
}

export function FormField({
  id,
  label,
  type = 'text',
  value,
  placeholder,
  autoComplete,
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
      onChange={(event) => onChange(event.target.value)}
      required
    />
  )
}
