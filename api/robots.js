// =====================================================================
// Vercel Function: /robots.txt (via rewrite no vercel.json)
// Libera as páginas públicas para os buscadores, bloqueia áreas privadas
// (painel, perfil, login...) e indica o sitemap com o domínio atual.
// =====================================================================

export default function handler(req, res) {
  const proto = req.headers['x-forwarded-proto'] || 'https'
  const host = req.headers['x-forwarded-host'] || req.headers.host
  const origin = `${proto}://${host}`

  // Endereços de preview da Vercel (*.vercel.app de branch) não devem ser indexados
  const isPreview = process.env.VERCEL_ENV && process.env.VERCEL_ENV !== 'production'

  const body = isPreview
    ? `User-agent: *\nDisallow: /\n`
    : `# Bloco Diz Que É
User-agent: *
Allow: /
Disallow: /admin
Disallow: /perfil
Disallow: /notificacoes
Disallow: /login
Disallow: /cadastro
Disallow: /recuperar-senha
Disallow: /redefinir-senha
Disallow: /completar-cadastro
Disallow: /api/

Sitemap: ${origin}/sitemap.xml
`

  res.setHeader('Content-Type', 'text/plain; charset=utf-8')
  res.setHeader('Cache-Control', 'public, max-age=3600, s-maxage=86400')
  res.status(200).send(body)
}
