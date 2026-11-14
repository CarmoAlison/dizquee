// "Ensaio Geral de Sábado!" -> "ensaio-geral-de-sabado"
export function slugify(text, maxLength = 80) {
  return String(text || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, maxLength)
    .replace(/-+$/g, '')
}

// Sufixo curto aleatório para evitar slug duplicado
export function slugSuffix() {
  return Math.random().toString(36).slice(2, 6)
}
