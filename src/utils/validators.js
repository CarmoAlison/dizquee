// Validações do front-end (o banco valida de novo com CHECK/UNIQUE)

export const USERNAME_RE = /^[a-z0-9_.]{3,30}$/
export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

// Normaliza o que a pessoa digita: minúsculo, sem espaços/acentos
export function normalizeUsername(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, '')
    .replace(/[^a-z0-9_.]/g, '')
    .slice(0, 30)
}

export function validateUsername(value) {
  if (!value) return 'Escolha um nome de usuário.'
  if (value.length < 3) return 'Use pelo menos 3 caracteres.'
  if (!USERNAME_RE.test(value)) return 'Use apenas letras minúsculas, números, ponto e sublinhado.'
  return ''
}

export function validateEmail(value) {
  if (!value) return 'Informe seu e-mail.'
  if (!EMAIL_RE.test(value.trim())) return 'E-mail inválido.'
  return ''
}

export function validatePassword(value) {
  if (!value) return 'Crie uma senha.'
  if (value.length < 8) return 'A senha precisa ter pelo menos 8 caracteres.'
  if (!/[A-Za-z]/.test(value) || !/[0-9]/.test(value)) return 'Use letras e números na senha.'
  return ''
}

export function validateFullName(value) {
  const v = String(value || '').trim()
  if (v.length < 2) return 'Informe seu nome.'
  if (v.length > 80) return 'Nome muito longo.'
  return ''
}

// Telefone em formato internacional (E.164). Brasil por padrão.
export function normalizePhone(value) {
  let digits = String(value || '').replace(/\D/g, '')
  if (!digits) return ''
  // Se digitou só DDD + número (10 ou 11 dígitos), assume Brasil (+55)
  if (digits.length === 10 || digits.length === 11) digits = `55${digits}`
  return `+${digits}`
}

export function validatePhone(value) {
  if (!value) return 'Informe seu telefone com DDD.'
  const normalized = normalizePhone(value)
  if (!/^\+[1-9][0-9]{7,14}$/.test(normalized)) return 'Telefone inválido. Ex.: (11) 91234-5678'
  return ''
}

// Exibição: +5511912345678 -> (11) 91234-5678
export function formatPhone(value) {
  const digits = String(value || '').replace(/\D/g, '')
  const local = digits.startsWith('55') && digits.length >= 12 ? digits.slice(2) : digits
  if (local.length === 11) return `(${local.slice(0, 2)}) ${local.slice(2, 7)}-${local.slice(7)}`
  if (local.length === 10) return `(${local.slice(0, 2)}) ${local.slice(2, 6)}-${local.slice(6)}`
  return value || ''
}
