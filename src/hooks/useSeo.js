// SEO por página: título, descrição, link canônico, robots (index/noindex),
// Open Graph/Twitter e dados estruturados (JSON-LD). O Google executa o
// JavaScript do site e lê essas tags; os robôs de redes sociais recebem a
// versão pronta da Vercel Function (api/share).
import { useEffect } from 'react'
import { SEO } from '../constants/brand'
import { useBrand } from './useBrand'

function setMeta(attr, key, content) {
  let el = document.head.querySelector(`meta[${attr}="${key}"]`)
  if (content === null || content === undefined || content === '') {
    el?.remove()
    return
  }
  if (!el) {
    el = document.createElement('meta')
    el.setAttribute(attr, key)
    document.head.appendChild(el)
  }
  el.setAttribute('content', content)
}

function setCanonical(href) {
  let el = document.head.querySelector('link[rel="canonical"]')
  if (!el) {
    el = document.createElement('link')
    el.setAttribute('rel', 'canonical')
    document.head.appendChild(el)
  }
  el.setAttribute('href', href)
}

function setJsonLd(data) {
  const id = 'ld-page'
  let el = document.getElementById(id)
  if (!data) {
    el?.remove()
    return
  }
  if (!el) {
    el = document.createElement('script')
    el.type = 'application/ld+json'
    el.id = id
    document.head.appendChild(el)
  }
  el.textContent = JSON.stringify(data)
}

function absolute(url) {
  if (!url) return ''
  return /^https?:\/\//.test(url) ? url : `${window.location.origin}${url.startsWith('/') ? '' : '/'}${url}`
}

/**
 * useSeo({ title, description, image, type, noindex, jsonLd })
 * - title: título da página (o nome do bloco é acrescentado)
 * - description: até ~160 caracteres
 * - noindex: true em páginas privadas (login, perfil, painel...)
 */
export function useSeo({ title, description, image, type = 'website', noindex = false, jsonLd = null } = {}) {
  const brand = useBrand()
  const jsonLdKey = jsonLd ? JSON.stringify(jsonLd) : ''

  useEffect(() => {
    const fullTitle = title ? `${title} | ${brand.name}` : `${brand.name} · ${SEO.city}`
    const desc = (description || brand.tagline || SEO.description).replace(/\s+/g, ' ').trim().slice(0, 160)
    const url = `${window.location.origin}${window.location.pathname}`
    const img = absolute(image || SEO.defaultImage)

    document.title = fullTitle
    setMeta('name', 'description', desc)
    setMeta('name', 'robots', noindex ? 'noindex, nofollow' : 'index, follow, max-image-preview:large')
    setCanonical(url)

    setMeta('property', 'og:type', type)
    setMeta('property', 'og:site_name', brand.name)
    setMeta('property', 'og:locale', 'pt_BR')
    setMeta('property', 'og:title', title || brand.name)
    setMeta('property', 'og:description', desc)
    setMeta('property', 'og:url', url)
    setMeta('property', 'og:image', img)
    setMeta('name', 'twitter:card', 'summary_large_image')
    setMeta('name', 'twitter:title', title || brand.name)
    setMeta('name', 'twitter:description', desc)
    setMeta('name', 'twitter:image', img)

    setJsonLd(jsonLdKey ? JSON.parse(jsonLdKey) : null)
  }, [title, description, image, type, noindex, jsonLdKey, brand.name, brand.tagline])

  // Ao sair da página, remove os dados estruturados específicos dela
  useEffect(() => () => setJsonLd(null), [])
}
