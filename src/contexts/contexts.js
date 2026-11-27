// Objetos de contexto (separados dos providers para manter o Fast Refresh)
import { createContext } from 'react'

export const AuthContext = createContext(null)
export const PermissionContext = createContext(null)
export const ThemeContext = createContext(null)
export const ToastContext = createContext(null)
export const LoginPromptContext = createContext(null)
export const NotificationsContext = createContext(null)
export const BrandContext = createContext(null)
export const CartContext = createContext(null)
