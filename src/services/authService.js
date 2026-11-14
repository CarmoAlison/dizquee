// Autenticação (e-mail/senha, Google, telefone OTP, recuperação de senha)
import { ROUTES } from '../constants/routes'
import { supabase } from './supabaseClient'

const origin = () => window.location.origin

export async function signInWithPassword(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
  if (error) throw error
  return data
}

// Os dados extras vão em user_metadata; o trigger handle_new_user cria o profile.
export async function signUpWithEmail({ email, password, fullName, username, phone, termsVersion }) {
  const { data, error } = await supabase.auth.signUp({
    email: email.trim(),
    password,
    options: {
      emailRedirectTo: `${origin()}${ROUTES.LOGIN}?confirmado=1`,
      data: { full_name: fullName.trim(), username, phone, terms_version: termsVersion },
    },
  })
  if (error) throw error
  // Supabase devolve usuário sem identities quando o e-mail já existe
  if (data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
    throw new Error('User already registered')
  }
  return data
}

export async function signInWithGoogle(redirectPath = ROUTES.HOME) {
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: `${origin()}${redirectPath}` },
  })
  if (error) throw error
}

export async function sendPhoneOtp(phone) {
  const { error } = await supabase.auth.signInWithOtp({ phone })
  if (error) throw error
}

export async function verifyPhoneOtp(phone, token) {
  const { data, error } = await supabase.auth.verifyOtp({ phone, token, type: 'sms' })
  if (error) throw error
  return data
}

export async function sendPasswordReset(email) {
  const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
    redirectTo: `${origin()}${ROUTES.RESET_PASSWORD}`,
  })
  if (error) throw error
}

export async function resendConfirmation(email) {
  const { error } = await supabase.auth.resend({
    type: 'signup',
    email: email.trim(),
    options: { emailRedirectTo: `${origin()}${ROUTES.LOGIN}?confirmado=1` },
  })
  if (error) throw error
}

export async function updatePassword(password) {
  const { error } = await supabase.auth.updateUser({ password })
  if (error) throw error
}

export async function signOut() {
  const { error } = await supabase.auth.signOut()
  if (error) throw error
}

export async function getSession() {
  const { data, error } = await supabase.auth.getSession()
  if (error) throw error
  return data.session
}

export function onAuthChange(callback) {
  const { data } = supabase.auth.onAuthStateChange((event, session) => callback(event, session))
  return () => data.subscription.unsubscribe()
}
