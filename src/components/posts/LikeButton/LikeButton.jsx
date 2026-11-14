import { cn } from '../../../utils/cn'
import { formatCount } from '../../../utils/formatDate'
import { Icon } from '../../common/Icon/Icon'
import styles from './LikeButton.module.css'

export function LikeButton({ liked, count = 0, onToggle, variant = 'default', label = 'post' }) {
  return (
    <button
      type="button"
      className={cn(styles.button, liked && styles.liked, variant === 'overlay' && styles.overlay)}
      onClick={onToggle}
      aria-pressed={Boolean(liked)}
      aria-label={`${liked ? 'Descurtir' : 'Curtir'} ${label}. ${count} curtida${count === 1 ? '' : 's'}`}
    >
      <Icon name="heart" filled={liked} size={24} className={styles.icon} />
      <span className={styles.count} aria-hidden="true">
        {formatCount(count)}
      </span>
    </button>
  )
}
