// Identidade visual: nome, slogan, logo e as 4 cores da marca.
// As cores aparecem ao vivo no painel enquanto você edita; se sair sem
// salvar, o site volta para as cores salvas.
import { useEffect, useRef, useState } from 'react'
import defaultLogo from '../../../assets/brand/logo-mark.svg'
import { BRAND, DEFAULT_COLORS } from '../../../constants/brand'
import { useBrand } from '../../../hooks/useBrand'
import { useToast } from '../../../hooks/useToast'
import { removeBrandLogo, updateBrandSettings, uploadBrandLogo } from '../../../services/brandService'
import { applyBrandColors } from '../../../utils/brand'
import { contrastRatio, isValidHex } from '../../../utils/color'
import { getErrorMessage } from '../../../utils/errors'
import { compressImage } from '../../../utils/imageCompression'
import { formatBytes } from '../../../utils/mediaUtils'
import { PageHeader } from '../../../components/admin/PageHeader/PageHeader'
import { Button } from '../../../components/common/Button/Button'
import { Icon } from '../../../components/common/Icon/Icon'
import { Input } from '../../../components/common/Input/Input'
import shared from '../adminShared.module.css'
import styles from './BrandSettings.module.css'

const MAX_LOGO = 2 * 1024 * 1024

const COLOR_FIELDS = [
  { key: 'primary1', label: 'Principal 1', hint: 'Cabeçalhos, botões e degradês (início).', against: '#FFFFFF', againstLabel: 'texto branco' },
  { key: 'primary2', label: 'Principal 2', hint: 'Fim dos degradês, destaques do painel.', against: '#FFFFFF', againstLabel: 'texto branco' },
  { key: 'accent1', label: 'Destaque 1', hint: 'Curtir, notificações e botões de ação.', against: null },
  { key: 'accent2', label: 'Destaque 2', hint: 'Anel dos stories, selos e botão "Criar conta".', against: '#2A0038', againstLabel: 'texto escuro' },
]

export default function BrandSettings() {
  const brand = useBrand()
  const toast = useToast()
  const fileRef = useRef(null)
  const [values, setValues] = useState({ name: brand.name, shortName: brand.shortName, tagline: brand.tagline })
  const [colors, setColors] = useState(brand.colors)
  const [hexDraft, setHexDraft] = useState(brand.colors)
  const [logoFile, setLogoFile] = useState(null)
  const [logoPreview, setLogoPreview] = useState(brand.logoUrl)
  const [removeLogo, setRemoveLogo] = useState(false)
  const [errors, setErrors] = useState({})
  const [saving, setSaving] = useState(false)
  const savedColorsRef = useRef(brand.colors)

  useEffect(() => {
    savedColorsRef.current = brand.colors
  }, [brand.colors])

  // Prévia ao vivo das cores em todo o painel
  useEffect(() => {
    applyBrandColors(colors)
  }, [colors])

  // Ao sair da página, volta para as cores salvas
  useEffect(() => () => applyBrandColors(savedColorsRef.current), [])

  useEffect(() => () => logoFile && URL.revokeObjectURL(logoPreview), [logoFile, logoPreview])

  const setColor = (key, value) => {
    setHexDraft((d) => ({ ...d, [key]: value }))
    if (isValidHex(value)) setColors((c) => ({ ...c, [key]: value.toUpperCase() }))
  }

  const pickLogo = async (file) => {
    if (!file) return
    if (!['image/png', 'image/svg+xml', 'image/webp', 'image/jpeg'].includes(file.type)) {
      toast.error('Use PNG, SVG, WebP ou JPG.')
      return
    }
    try {
      // SVG fica como está; imagens viram WebP até 512 px (logo leve)
      const final = file.type === 'image/svg+xml' ? file : await compressImage(file, { fileType: 'image/webp', maxDimension: 512, quality: 0.9 })
      if (final.size > MAX_LOGO) {
        toast.error(`Logo acima de ${formatBytes(MAX_LOGO)}.`)
        return
      }
      setLogoFile(final)
      setLogoPreview(URL.createObjectURL(final))
      setRemoveLogo(false)
    } catch {
      toast.error('Não foi possível ler esta imagem.')
    }
  }

  const resetDefaults = () => {
    setColors(DEFAULT_COLORS)
    setHexDraft(DEFAULT_COLORS)
    setValues({ name: BRAND.name, shortName: BRAND.shortName, tagline: BRAND.tagline })
    setLogoFile(null)
    setLogoPreview(defaultLogo)
    setRemoveLogo(true)
  }

  const save = async (e) => {
    e.preventDefault()
    const next = {
      name: values.name.trim().length < 2 ? 'Informe o nome do bloco.' : '',
      shortName: values.shortName.trim().length < 2 ? 'Informe um nome curto.' : values.shortName.trim().length > 24 ? 'Máximo de 24 caracteres.' : '',
    }
    setErrors(next)
    if (next.name || next.shortName) return
    setSaving(true)
    try {
      let logoPath = brand.logoPath
      if (logoFile) logoPath = await uploadBrandLogo(logoFile)
      else if (removeLogo) logoPath = null
      await updateBrandSettings({
        brand_name: values.name.trim(),
        short_name: values.shortName.trim(),
        tagline: values.tagline.trim(),
        logo_path: logoPath,
        color_primary_1: colors.primary1,
        color_primary_2: colors.primary2,
        color_accent_1: colors.accent1,
        color_accent_2: colors.accent2,
      })
      if (brand.logoPath && brand.logoPath !== logoPath) await removeBrandLogo(brand.logoPath).catch(() => {})
      savedColorsRef.current = colors
      await brand.refresh()
      setLogoFile(null)
      setRemoveLogo(false)
      toast.success('Identidade visual salva! O site já está com a nova cara.')
    } catch (err) {
      toast.error(getErrorMessage(err, 'Não foi possível salvar.'))
    } finally {
      setSaving(false)
    }
  }

  const previewStyle = {
    '--p1': colors.primary1,
    '--p2': colors.primary2,
    '--a1': colors.accent1,
    '--a2': colors.accent2,
  }

  return (
    <>
      <PageHeader title="Identidade visual" description="Nome, logo e cores do bloco. Vale para o site inteiro e para o painel." />

      <form className={styles.layout} onSubmit={save} noValidate>
        <div className={shared.stack}>
          <section className={shared.card} aria-labelledby="brand-name">
            <h2 id="brand-name" className={shared.cardTitle}>
              Nome e slogan
            </h2>
            <div className={shared.formGrid}>
              <Input label="Nome do bloco" value={values.name} onChange={(e) => setValues((v) => ({ ...v, name: e.target.value }))} error={errors.name} maxLength={60} required />
              <Input
                label="Nome curto"
                value={values.shortName}
                onChange={(e) => setValues((v) => ({ ...v, shortName: e.target.value }))}
                error={errors.shortName}
                hint="Aparece ao lado do logo."
                maxLength={24}
                required
              />
              <Input
                as="textarea"
                rows={2}
                className={shared.full}
                label="Slogan"
                value={values.tagline}
                onChange={(e) => setValues((v) => ({ ...v, tagline: e.target.value }))}
                maxLength={140}
                hint="Aparece no banner da página inicial e no rodapé."
              />
            </div>
          </section>

          <section className={shared.card} aria-labelledby="brand-logo">
            <h2 id="brand-logo" className={shared.cardTitle}>
              Logo
            </h2>
            <div className={styles.logoRow}>
              <div className={styles.logoBox}>
                <img src={logoPreview} alt="Prévia do logo" />
              </div>
              <div className={styles.logoText}>
                <p className={shared.muted}>
                  Use uma imagem quadrada (ou SVG) com fundo transparente. PNG/JPG/WebP são reduzidos para 512 px.
                </p>
                <div className={styles.logoActions}>
                  <Button variant="secondary" size="sm" icon="upload" onClick={() => fileRef.current?.click()}>
                    Enviar logo
                  </Button>
                  {(brand.logoPath || logoFile) && !removeLogo && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setLogoFile(null)
                        setRemoveLogo(true)
                        setLogoPreview(defaultLogo)
                      }}
                    >
                      Usar logo padrão
                    </Button>
                  )}
                </div>
              </div>
              <input
                ref={fileRef}
                type="file"
                hidden
                accept="image/png,image/svg+xml,image/webp,image/jpeg"
                onChange={(e) => {
                  pickLogo(e.target.files?.[0])
                  e.target.value = ''
                }}
              />
            </div>
          </section>

          <section className={shared.card} aria-labelledby="brand-colors">
            <h2 id="brand-colors" className={shared.cardTitle}>
              Cores
            </h2>
            <p className={shared.muted}>O painel muda ao vivo enquanto você escolhe. Se sair sem salvar, nada é alterado.</p>
            <div className={styles.colors}>
              {COLOR_FIELDS.map((f) => {
                const ratio = f.against ? contrastRatio(colors[f.key], f.against) : null
                const ok = ratio === null || ratio >= 4.5
                return (
                  <div key={f.key} className={styles.colorField}>
                    <label className={styles.swatch} style={{ background: colors[f.key] }}>
                      <span className="visually-hidden">Escolher {f.label}</span>
                      <input type="color" value={colors[f.key]} onChange={(e) => setColor(f.key, e.target.value)} />
                    </label>
                    <div className={styles.colorInfo}>
                      <span className={styles.colorLabel}>{f.label}</span>
                      <span className={styles.colorHint}>{f.hint}</span>
                      <input
                        className={styles.hex}
                        value={hexDraft[f.key]}
                        onChange={(e) => setColor(f.key, e.target.value.startsWith('#') ? e.target.value : `#${e.target.value}`)}
                        maxLength={7}
                        aria-label={`Código hexadecimal da cor ${f.label}`}
                        spellCheck={false}
                      />
                      {ratio !== null && (
                        <span className={ok ? styles.contrastOk : styles.contrastBad}>
                          <Icon name={ok ? 'check' : 'alert'} size={14} />
                          Contraste com {f.againstLabel}: {ratio.toFixed(1).replace('.', ',')}:1 {ok ? '' : '(baixo: prefira um tom mais escuro)'}
                        </span>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </section>
        </div>

        <aside className={styles.side}>
          <section className={shared.card} aria-labelledby="brand-preview">
            <h2 id="brand-preview" className={shared.cardTitle}>
              Prévia
            </h2>
            <div className={styles.preview} style={previewStyle}>
              <div className={styles.previewHeader}>
                <img src={logoPreview} alt="" width={28} height={28} />
                <strong>{values.shortName || 'Nome'}</strong>
                <span className={styles.previewCta}>Criar conta</span>
              </div>
              <div className={styles.previewHero}>
                <strong>Bem-vindo ao {values.name || 'bloco'}</strong>
                <span>{values.tagline}</span>
              </div>
              <div className={styles.previewBody}>
                <div className={styles.previewStories}>
                  {[1, 2, 3].map((i) => (
                    <span key={i} className={styles.previewRing}>
                      <span />
                    </span>
                  ))}
                </div>
                <div className={styles.previewButtons}>
                  <span className={styles.previewPrimary}>Botão principal</span>
                  <span className={styles.previewLike}>
                    <Icon name="heart" filled size={16} /> 128
                  </span>
                </div>
              </div>
            </div>
          </section>

          <div className={styles.actions}>
            <Button variant="ghost" icon="refresh" onClick={resetDefaults}>
              Restaurar padrão
            </Button>
            <Button type="submit" loading={saving}>
              Salvar identidade
            </Button>
          </div>
          <p className={shared.muted}>
            Ícones do app instalado (PWA) e a fonte ficam no código: veja <code>src/assets/brand/README.md</code>.
          </p>
        </aside>
      </form>
    </>
  )
}
