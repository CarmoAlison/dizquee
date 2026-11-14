import { Link } from 'react-router'
import { cn } from '../../../utils/cn'
import { Icon } from '../Icon/Icon'
import { Loader } from '../Loader/Loader'
import styles from './Button.module.css'

/**
 * variant: primary (degradê) | secondary | ghost | danger | accent
 * size: sm | md | lg
 * to: vira <Link>; href: vira <a>
 * iconOnly: botão quadrado só com ícone (exige aria-label)
 */
export function Button({
  children,
  variant = 'primary',
  size = 'md',
  icon,
  iconRight,
  iconOnly = false,
  loading = false,
  fullWidth = false,
  to,
  href,
  className,
  disabled,
  type = 'button',
  ...rest
}) {
  const classes = cn(
    styles.button,
    styles[variant],
    styles[size],
    iconOnly && styles.iconOnly,
    fullWidth && styles.fullWidth,
    loading && styles.loading,
    className,
  )
  const content = (
    <>
      {loading ? <Loader size="sm" inline /> : icon && <Icon name={icon} size={size === 'sm' ? 18 : 20} />}
      {!iconOnly && children && <span className={styles.label}>{children}</span>}
      {iconRight && !loading && <Icon name={iconRight} size={18} />}
    </>
  )

  if (to) {
    return (
      <Link to={to} className={classes} {...rest}>
        {content}
      </Link>
    )
  }
  if (href) {
    return (
      <a href={href} className={classes} {...rest}>
        {content}
      </a>
    )
  }
  return (
    <button type={type} className={classes} disabled={disabled || loading} aria-busy={loading || undefined} {...rest}>
      {content}
    </button>
  )
}
