// Converte erros do Supabase/Auth em mensagens claras em português
const AUTH_MESSAGES = [
  [/invalid login credentials/i, 'E-mail ou senha incorretos.'],
  [/email not confirmed/i, 'Confirme seu e-mail antes de entrar. Verifique sua caixa de entrada (e o spam).'],
  [/user already registered|already been registered/i, 'Este e-mail já está cadastrado. Tente entrar ou recuperar a senha.'],
  [/password should be at least/i, 'A senha é muito curta.'],
  [/weak.?password|password is known to be weak/i, 'Senha fraca. Use letras, números e pelo menos 8 caracteres.'],
  [/same.?password|different from the old password/i, 'A nova senha precisa ser diferente da anterior.'],
  [/rate limit|too many requests|security purposes/i, 'Muitas tentativas. Aguarde alguns instantes e tente de novo.'],
  [/token has expired|otp.*expired|expired/i, 'O código ou link expirou. Peça um novo.'],
  [/invalid.*otp|token.*invalid|invalid token/i, 'Código inválido. Confira e tente de novo.'],
  [/phone.*(provider|sms).*(disabled|not enabled)|sms.*not.*configured|unsupported phone provider/i, 'Login por telefone ainda não está disponível.'],
  [/invalid phone|phone.*invalid/i, 'Telefone inválido.'],
  [/signups not allowed|signup.*disabled/i, 'Novos cadastros estão desativados no momento.'],
  [/provider is not enabled/i, 'Este método de login ainda não está ativado.'],
  [/failed to fetch|network/i, 'Sem conexão com o servidor. Verifique sua internet.'],
  [/jwt expired/i, 'Sua sessão expirou. Entre novamente.'],
]

const DB_CODES = {
  '23505': 'Já existe um registro com esses dados.',
  '23503': 'Este item está em uso e não pode ser removido.',
  '23514': 'Algum dado está fora do formato permitido.',
  '42501': 'Você não tem permissão para fazer isso.',
  PGRST116: 'Item não encontrado.',
}

export function getErrorMessage(error, fallback = 'Algo deu errado. Tente novamente.') {
  if (!error) return fallback
  const message = typeof error === 'string' ? error : error.message || ''

  // Mensagens levantadas pelos nossos triggers/funções já estão em português
  if (error.code === 'P0001' || (error.code === '42501' && /[áéíóúãõç]/i.test(message))) {
    return message
  }
  if (/row-level security|violates row-level/i.test(message)) {
    return 'Você não tem permissão para fazer isso.'
  }
  if (error.code && DB_CODES[error.code]) {
    if (error.code === '23505' && /username/i.test(message)) return 'Este nome de usuário já está em uso.'
    if (error.code === '23505' && /slug/i.test(message)) return 'Já existe um item com este endereço (slug).'
    if (error.code === '23503' && /[áéíóúãõç]/i.test(message)) return message
    return DB_CODES[error.code]
  }
  for (const [re, text] of AUTH_MESSAGES) {
    if (re.test(message)) return text
  }
  // Mensagem em português vinda do banco
  if (/[áéíóúãõç]/i.test(message)) return message
  return fallback
}
