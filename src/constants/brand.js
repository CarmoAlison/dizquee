// Valores padrão da marca. O que vale de verdade fica salvo no banco
// (tabela app_settings) e é editado em Painel › Identidade visual.
export const BRAND = {
  name: 'Bloco Diz Que É',
  shortName: 'Diz Que É',
  tagline: 'Novidades, fotos, vídeos e stories do bloco.',
}

export const DEFAULT_COLORS = {
  primary1: '#660385',
  primary2: '#AB00B3',
  accent1: '#FF0096',
  accent2: '#FDCB26',
}

// Informações para o Google (SEO). Edite à vontade.
// Também usadas no index.html (versão inicial) e nas Vercel Functions
// de sitemap/compartilhamento — se mudar aqui, confira lá também.
export const SEO = {
  description:
    'Portal oficial do Bloco Diz Que É, de Macau/RN: novidades, fotos, vídeos e stories do bloco de carnaval. Acompanhe, curta e comente!',
  city: 'Macau/RN',
  defaultImage: '/icons/og-default.png',
}
