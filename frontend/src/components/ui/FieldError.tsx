/** Message shown right under the field (linked to it with aria-describedby). */
export function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null
  return (
    <span id={id} role="alert" className="text-sm font-semibold text-red-700">
      {message}
    </span>
  )
}
