import type { PropsWithChildren } from 'react'

interface ContainerProps extends PropsWithChildren {
  className?: string
}

export function Container({ children, className = '' }: ContainerProps) {
  return <div className={`mx-auto w-full max-w-7xl px-5 sm:px-6 lg:px-8 ${className}`}>{children}</div>
}
