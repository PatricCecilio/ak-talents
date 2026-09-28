import type { PropsWithChildren } from 'react'

interface ContainerProps extends PropsWithChildren {
  className?: string
}

export function Container({ children, className = '' }: ContainerProps) {
  return <div className={`mx-0 w-full max-w-[390px] px-5 sm:mx-auto sm:max-w-[1400px] sm:px-7 lg:px-10 ${className}`}>{children}</div>
}
