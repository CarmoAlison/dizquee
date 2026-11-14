// Reações rápidas com emoji (renderizadas como emoji na tela)
import { STORY_REACTIONS } from '../../../constants/reactions'
import { cn } from '../../../utils/cn'
import styles from './ReactionPicker.module.css'

export function ReactionPicker({ selected = [], counts = {}, onToggle }) {
  return (
    <div className={styles.picker} role="group" aria-label="Reações rápidas">
      {STORY_REACTIONS.map(({ emoji, label }) => {
        const active = selected.includes(emoji)
        const count = counts[emoji] || 0
        return (
          <button
            key={emoji}
            type="button"
            className={cn(styles.reaction, active && styles.active)}
            onClick={() => onToggle(emoji)}
            aria-pressed={active}
            aria-label={`${label}${count ? `, ${count}` : ''}`}
            title={label}
          >
            <span className={styles.emoji} aria-hidden="true">
              {emoji}
            </span>
            {count > 0 && (
              <span className={styles.count} aria-hidden="true">
                {count}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}
