import { useTheme } from '../../../hooks/useTheme'
import { cn } from '../../../utils/cn'
import { Icon } from '../Icon/Icon'
import styles from './ThemeToggle.module.css'

export function ThemeToggle({ withLabel = false, className }) {
  const { theme, toggleTheme } = useTheme()
  const dark = theme === 'dark'
  const label = dark ? 'Ativar modo claro' : 'Ativar modo escuro'
  return (
    <button
      type="button"
      className={cn(styles.toggle, withLabel && styles.withLabel, className)}
      onClick={toggleTheme}
      aria-label={withLabel ? undefined : label}
      aria-pressed={dark}
      title={label}
    >
      <Icon name={dark ? 'sun' : 'moon'} />
      {withLabel && <span>{dark ? 'Modo claro' : 'Modo escuro'}</span>}
    </button>
  )
}
