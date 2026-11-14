// Logo do bloco. O logo e o nome vêm de Painel › Identidade visual
// (sem logo enviado, usa o placeholder de src/assets/brand/logo-mark.svg).
import { useBrand } from '../../../hooks/useBrand'
import { cn } from '../../../utils/cn'
import styles from './Logo.module.css'

/** variant: 'full' (marca + nome) | 'mark' (só o símbolo). tone: 'default' | 'light' */
export function Logo({ variant = 'full', size = 36, tone = 'default', className }) {
  const brand = useBrand()
  return (
    <span className={cn(styles.logo, tone === 'light' && styles.light, className)}>
      <img
        src={brand.logoUrl}
        alt={variant === 'mark' ? brand.name : ''}
        width={size}
        height={size}
        className={styles.mark}
        style={{ width: size, height: size }}
      />
      {variant === 'full' && <span className={styles.name}>{brand.shortName}</span>}
    </span>
  )
}
