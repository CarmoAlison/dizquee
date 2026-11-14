// Barra de stories: círculos com anel degradê (não visto) ou cinza (visto)
import { highlightCoverUrl } from '../../../services/highlightsService'
import { useBrand } from '../../../hooks/useBrand'
import { cn } from '../../../utils/cn'
import { Avatar } from '../../common/Avatar/Avatar'
import { Skeleton } from '../../common/Skeleton/Skeleton'
import styles from './StoriesBar.module.css'

export function StoriesBar({ groups, loading, onOpen, className }) {
  const brand = useBrand()
  if (loading) {
    return (
      <div className={cn(styles.bar, className)} aria-hidden="true">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className={styles.item}>
            <Skeleton variant="circle" width={72} height={72} />
            <Skeleton variant="text" width={56} />
          </div>
        ))}
      </div>
    )
  }

  if (!groups.length) return null

  return (
    <nav className={cn(styles.bar, className)} aria-label="Stories e destaques">
      {groups.map((group, index) => {
        const cover = group.isActive ? brand.logoUrl : highlightCoverUrl(group.highlight, group.stories[0])
        const label = group.isActive ? 'Stories de agora' : `Destaque: ${group.title}`
        return (
          <button
            key={group.id}
            type="button"
            className={styles.item}
            onClick={() => onOpen(index)}
            aria-label={`${label}${group.allSeen ? ' (visto)' : ' (novo)'}`}
          >
            <Avatar src={cover} name={group.isActive ? brand.shortName : group.title} size={72} ring seen={group.allSeen} />
            <span className={styles.title}>{group.isActive ? 'Agora' : group.title}</span>
          </button>
        )
      })}
    </nav>
  )
}
