interface AIResultListProps {
  title: string
  items: string[]
}

export function AIResultList({ title, items }: AIResultListProps) {
  if (items.length === 0) {
    return null
  }

  return (
    <div>
      <h4 className="text-sm font-black uppercase tracking-[0.16em] text-ink-400">{title}</h4>
      <ul className="mt-3 grid gap-2 text-sm leading-6 text-ink-700">
        {items.map((item) => (
          <li key={item} className="rounded-lg bg-slate-50 px-3 py-2">
            {item}
          </li>
        ))}
      </ul>
    </div>
  )
}
