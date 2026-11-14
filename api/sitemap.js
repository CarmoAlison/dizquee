// =====================================================================
// Vercel Function: /sitemap.xml (via rewrite no vercel.json)
// Lista para o Google as páginas públicas e TODOS os posts publicados,
// com data de atualização e a primeira foto (image sitemap). É gerado na
// hora, então posts novos entram sozinhos. Usa só a anon key.
// =====================================================================

const SUPABASE_URL = (process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '').replace(/\/$/, '')
const ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || ''

function xml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

function mediaUrl(path) {
  return `${SUPABASE_URL}/storage/v1/object/public/post-media/${path.split('/').map(encodeURIComponent).join('/')}`
}

async function fetchPosts() {
  if (!SUPABASE_URL || !ANON_KEY) return []
  const url =
    `${SUPABASE_URL}/rest/v1/posts?select=slug,title,updated_at,published_at,post_media(type,storage_path,position)` +
    `&status=eq.published&published_at=lte.${encodeURIComponent(new Date().toISOString())}&order=published_at.desc&limit=5000`
  const res = await fetch(url, { headers: { apikey: ANON_KEY, Authorization: `Bearer ${ANON_KEY}` } })
  if (!res.ok) return []
  return res.json()
}

export default async function handler(req, res) {
  const proto = req.headers['x-forwarded-proto'] || 'https'
  const host = req.headers['x-forwarded-host'] || req.headers.host
  const origin = `${proto}://${host}`

  let posts = []
  try {
    posts = await fetchPosts()
  } catch {
    posts = []
  }

  const lastPost = posts[0]?.updated_at || posts[0]?.published_at || new Date().toISOString()

  const pages = [
    { loc: `${origin}/`, lastmod: lastPost, changefreq: 'daily', priority: '1.0' },
    { loc: `${origin}/stories`, lastmod: new Date().toISOString(), changefreq: 'daily', priority: '0.8' },
    { loc: `${origin}/termos`, changefreq: 'yearly', priority: '0.2' },
    { loc: `${origin}/privacidade`, changefreq: 'yearly', priority: '0.2' },
  ]

  const urls = [
    ...pages.map(
      (p) => `  <url>
    <loc>${xml(p.loc)}</loc>${p.lastmod ? `\n    <lastmod>${xml(p.lastmod)}</lastmod>` : ''}
    <changefreq>${p.changefreq}</changefreq>
    <priority>${p.priority}</priority>
  </url>`,
    ),
    ...posts.map((post) => {
      const images = [...(post.post_media || [])]
        .filter((m) => m.type === 'image')
        .sort((a, b) => a.position - b.position)
        .slice(0, 5)
      return `  <url>
    <loc>${xml(`${origin}/post/${post.slug}`)}</loc>
    <lastmod>${xml(post.updated_at || post.published_at)}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.7</priority>${images
      .map((m) => `\n    <image:image><image:loc>${xml(mediaUrl(m.storage_path))}</image:loc><image:title>${xml(post.title)}</image:title></image:image>`)
      .join('')}
  </url>`
    }),
  ]

  const body = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
${urls.join('\n')}
</urlset>
`

  res.setHeader('Content-Type', 'application/xml; charset=utf-8')
  res.setHeader('Cache-Control', 'public, max-age=600, s-maxage=1800, stale-while-revalidate=86400')
  res.status(200).send(body)
}
