import type { PropsWithChildren, ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { getCurrentUser, isAuthenticated } from '../services/authService'
import { doorPathForRole } from '../services/loginDoors'
import type { UserRole } from '../types/user'

interface PrivateRouteProps extends PropsWithChildren {
  allowedRoles?: UserRole[]
  /** Shown instead of jumping to a login door (e.g. /painel lets the person pick the admin or recruiter door). */
  signedOut?: ReactNode
}

export function PrivateRoute({ children, allowedRoles, signedOut }: PrivateRouteProps) {
  const location = useLocation()
  const currentUser = getCurrentUser()

  if (!isAuthenticated()) {
    if (signedOut) return signedOut
    // Straight to the right login door: /recrutador -> /recrutamento, /admin -> /equipe, and so on.
    return <Navigate to={doorPathForRole(allowedRoles?.[0])} replace state={{ from: location.pathname }} />
  }

  if (allowedRoles && (!currentUser || !allowedRoles.includes(currentUser.role))) {
    return <Navigate to="/" replace />
  }

  return children
}
