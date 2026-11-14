// Converte a linha de app_settings na marca usada pela interface
import defaultLogo from '../assets/brand/logo-mark.svg'
import { BRAND, DEFAULT_COLORS } from '../constants/brand'
import { brandLogoUrl } from '../services/brandService'
import { isValidHex } from './color'

export function toBrand(row) {
  return {
    name: row?.brand_name || BRAND.name,
    shortName: row?.short_name || BRAND.shortName,
    tagline: row?.tagline || BRAND.tagline,
    logoPath: row?.logo_path || null,
    logoUrl: row?.logo_path ? brandLogoUrl(row.logo_path) : defaultLogo,
    colors: {
      primary1: isValidHex(row?.color_primary_1) ? row.color_primary_1 : DEFAULT_COLORS.primary1,
      primary2: isValidHex(row?.color_primary_2) ? row.color_primary_2 : DEFAULT_COLORS.primary2,
      accent1: isValidHex(row?.color_accent_1) ? row.color_accent_1 : DEFAULT_COLORS.accent1,
      accent2: isValidHex(row?.color_accent_2) ? row.color_accent_2 : DEFAULT_COLORS.accent2,
    },
  }
}

// Aplica as cores no :root (as demais cores derivam delas em themes.css)
export function applyBrandColors(colors) {
  const root = document.documentElement.style
  root.setProperty('--color-primary-1', colors.primary1)
  root.setProperty('--color-primary-2', colors.primary2)
  root.setProperty('--color-accent-1', colors.accent1)
  root.setProperty('--color-accent-2', colors.accent2)
  if (document.documentElement.getAttribute('data-theme') !== 'dark') {
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', colors.primary1)
  }
}

