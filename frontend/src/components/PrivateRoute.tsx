import type { PropsWithChildren } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { getCurrentUser, isAuthenticated } from '../services/authService'
import type { UserRole } from '../types/user'

interface PrivateRouteProps extends PropsWithChildren {
  allowedRoles?: UserRole[]
}

export function PrivateRoute({ children, allowedRoles }: PrivateRouteProps) {
  const location = useLocation()
  const currentUser = getCurrentUser()

  if (!isAuthenticated()) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />
  }

  if (allowedRoles && (!currentUser || !allowedRoles.includes(currentUser.role))) {
    return <Navigate to="/" replace />
  }

  return children
}
