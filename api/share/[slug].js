// =====================================================================
// Vercel Function: /api/share/:slug
// O site é SPA, então os robôs de preview (WhatsApp, Facebook, Instagram,
// X, Telegram...) não executam o JavaScript. O vercel.json reescreve
// /post/:slug para cá quando o user-agent é de robô, e esta função devolve
// um HTML com as meta tags Open Graph/Twitter do post. Pessoas que caírem
// aqui são redirecionadas para a rota normal /post/:slug.
// Usa só a anon key (lê posts publicados, como qualquer visitante).
// =====================================================================

const SUPABASE_URL = (process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '').replace(/\/$/, '')
const ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || ''
const DEFAULT_SITE_NAME = 'Bloco Diz Que É'

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function excerpt(text, max = 180) {
  const clean = String(text || '').replace(/\s+/g, ' ').trim()
  return clean.length > max ? `${clean.slice(0, max - 1)}…` : clean
}

function publicUrl(path) {
  return `${SUPABASE_URL}/storage/v1/object/public/post-media/${path.split('/').map(encodeURIComponent).join('/')}`
}

// Nome do bloco configurado em Painel › Identidade visual
async function fetchSiteName() {
  if (!SUPABASE_URL || !ANON_KEY) return DEFAULT_SITE_NAME
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/app_settings?select=brand_name&id=eq.1`, {
      headers: { apikey: ANON_KEY, Authorization: `Bearer ${ANON_KEY}` },
    })
    const rows = res.ok ? await res.json() : []
    return rows?.[0]?.brand_name || DEFAULT_SITE_NAME
  } catch {
    return DEFAULT_SITE_NAME
  }
}

async function fetchPost(slug) {
  if (!SUPABASE_URL || !ANON_KEY) return null
  const url =
    `${SUPABASE_URL}/rest/v1/posts?select=title,content,slug,published_at,updated_at,post_media(type,storage_path,position,width,height)` +
    `&slug=eq.${encodeURIComponent(slug)}&status=eq.published&limit=1`
  const res = await fetch(url, { headers: { apikey: ANON_KEY, Authorization: `Bearer ${ANON_KEY}` } })
  if (!res.ok) return null
  const rows = await res.json()
  return rows?.[0] || null
}

export default async function handler(req, res) {
  const slug = String(req.query.slug || '').toLowerCase()
  const proto = req.headers['x-forwarded-proto'] || 'https'
  const host = req.headers['x-forwarded-host'] || req.headers.host
  const origin = `${proto}://${host}`
  const pageUrl = `${origin}/post/${encodeURIComponent(slug)}`

  const SITE_NAME = await fetchSiteName()
  let post = null
  if (/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug)) {
    try {
      post = await fetchPost(slug)
    } catch {
      post = null
    }
  }

  const media = [...(post?.post_media || [])].sort((a, b) => a.position - b.position)
  const image = media.find((m) => m.type === 'image')
  const title = post ? `${post.title} | ${SITE_NAME}` : SITE_NAME
  const description = post ? excerpt(post.content) || 'Veja no site do bloco.' : 'Novidades, fotos, vídeos e stories do bloco.'
  const imageUrl = image ? publicUrl(image.storage_path) : `${origin}/icons/og-default.png`

  // Robôs (Google, Bing, WhatsApp, Facebook...) recebem a página completa,
  // SEM redirecionar (redirecionar para a própria URL geraria loop no Google).
  // Pessoas que abrirem /api/share/... direto são levadas para o site.
  const ua = String(req.headers['user-agent'] || '')
  const isBot = /bot|crawl|spider|slurp|facebookexternalhit|facebot|whatsapp|telegram|discord|skype|embedly|pinterest|instagram|linkedin|preview/i.test(ua)

  const jsonLd = post
    ? {
        '@context': 'https://schema.org',
        '@type': 'NewsArticle',
        headline: post.title.slice(0, 110),
        description,
        image: media.filter((m) => m.type === 'image').map((m) => publicUrl(m.storage_path)).slice(0, 5),
        datePublished: post.published_at,
        dateModified: post.updated_at || post.published_at,
        author: { '@type': 'Organization', name: SITE_NAME, url: `${origin}/` },
        publisher: { '@type': 'Organization', name: SITE_NAME, logo: { '@type': 'ImageObject', url: `${origin}/icons/icon-512.png` } },
        mainEntityOfPage: pageUrl,
      }
    : null

  const paragraphs = String(post?.content || '')
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => `<p>${escapeHtml(p).replace(/\n/g, '<br />')}</p>`)
    .join('\n')

  const images = media
    .filter((m) => m.type === 'image')
    .map((m, i) => `<img src="${escapeHtml(publicUrl(m.storage_path))}" alt="${escapeHtml(post.title)} - foto ${i + 1}"${m.width ? ` width="${Number(m.width)}" height="${Number(m.height)}"` : ''} />`)
    .join('\n')

  const html = `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${escapeHtml(title)}</title>
<meta name="description" content="${escapeHtml(description)}" />
<meta name="robots" content="${post ? 'index, follow, max-image-preview:large' : 'noindex'}" />
<link rel="canonical" href="${escapeHtml(pageUrl)}" />
<meta property="og:type" content="article" />
<meta property="og:site_name" content="${escapeHtml(SITE_NAME)}" />
<meta property="og:locale" content="pt_BR" />
<meta property="og:title" content="${escapeHtml(post?.title || SITE_NAME)}" />
<meta property="og:description" content="${escapeHtml(description)}" />
<meta property="og:url" content="${escapeHtml(pageUrl)}" />
<meta property="og:image" content="${escapeHtml(imageUrl)}" />
${image?.width ? `<meta property="og:image:width" content="${Number(image.width)}" />` : ''}
${image?.height ? `<meta property="og:image:height" content="${Number(image.height)}" />` : ''}
${post?.published_at ? `<meta property="article:published_time" content="${escapeHtml(post.published_at)}" />` : ''}
<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:title" content="${escapeHtml(post?.title || SITE_NAME)}" />
<meta name="twitter:description" content="${escapeHtml(description)}" />
<meta name="twitter:image" content="${escapeHtml(imageUrl)}" />
${jsonLd ? `<script type="application/ld+json">${JSON.stringify(jsonLd).replace(/</g, '\\u003c')}</script>` : ''}
${isBot ? '' : `<meta http-equiv="refresh" content="0; url=${escapeHtml(pageUrl)}" />`}
</head>
<body>
<header><a href="${escapeHtml(origin)}/">${escapeHtml(SITE_NAME)}</a></header>
<main>
<article>
<h1>${escapeHtml(post?.title || 'Post não encontrado')}</h1>
${post?.published_at ? `<time datetime="${escapeHtml(post.published_at)}">${escapeHtml(new Date(post.published_at).toLocaleDateString('pt-BR'))}</time>` : ''}
${images}
${paragraphs}
</article>
</main>
<footer><a href="${escapeHtml(origin)}/">Ver mais novidades do ${escapeHtml(SITE_NAME)}</a></footer>
${isBot ? '' : `<script>window.location.replace(${JSON.stringify(pageUrl).replace(/</g, '\\u003c')})</script>`}
</body>
</html>`

  res.setHeader('Content-Type', 'text/html; charset=utf-8')
  res.setHeader('Cache-Control', 'public, max-age=300, s-maxage=600, stale-while-revalidate=86400')
  res.status(post ? 200 : 404).send(html)
}
