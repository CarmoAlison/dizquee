// Compartilhar: Web Share API quando existe (celular: folha nativa com
// WhatsApp, Instagram etc.); senão, menu com WhatsApp e copiar link.
// Obs.: o Instagram não tem link de compartilhamento web para o feed.
import { useState } from 'react'
import { useToast } from '../../../hooks/useToast'
import { canUseWebShare, copyToClipboard, whatsappShareUrl } from '../../../utils/share'
import { Icon } from '../../common/Icon/Icon'
import { Modal } from '../../common/Modal/Modal'
import styles from './ShareButton.module.css'

export function ShareButton({ title, text, url, variant = 'default' }) {
  const toast = useToast()
  const [menuOpen, setMenuOpen] = useState(false)

  const handleClick = async () => {
    if (canUseWebShare()) {
      try {
        await navigator.share({ title, text: text || title, url })
        return
      } catch (e) {
        if (e?.name === 'AbortError') return
      }
    }
    setMenuOpen(true)
  }

  const copy = async () => {
    try {
      await copyToClipboard(url)
      toast.success('Link copiado!')
      setMenuOpen(false)
    } catch {
      toast.error('Não foi possível copiar o link.')
    }
  }

  return (
    <>
      <button
        type="button"
        className={variant === 'overlay' ? styles.overlay : styles.button}
        onClick={handleClick}
        aria-label="Compartilhar"
      >
        <Icon name="share" size={22} />
      </button>
      <Modal open={menuOpen} onClose={() => setMenuOpen(false)} title="Compartilhar" size="sm">
        <div className={styles.options}>
          <a
            className={styles.option}
            href={whatsappShareUrl(title, url)}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => setMenuOpen(false)}
          >
            <span className={`${styles.optionIcon} ${styles.whatsapp}`}>
              <Icon name="whatsapp" />
            </span>
            WhatsApp
          </a>
          <button type="button" className={styles.option} onClick={copy}>
            <span className={styles.optionIcon}>
              <Icon name="link" />
            </span>
            Copiar link
          </button>
        </div>
        <p className={styles.note}>Para o Instagram, copie o link e cole no seu story ou na bio.</p>
      </Modal>
    </>
  )
}
