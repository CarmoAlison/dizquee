// Estatísticas de um story (stories.view_stats): views, curtidas,
// comentários, reações e lista de quem viu (usuários logados).
import { STORY_REACTIONS } from '../../../constants/reactions'
import { useAsync } from '../../../hooks/useAsync'
import { getStoryStats, getStoryViewers } from '../../../services/storiesService'
import { formatRelative } from '../../../utils/formatDate'
import { Avatar } from '../../common/Avatar/Avatar'
import { EmptyState } from '../../common/EmptyState/EmptyState'
import { ErrorState } from '../../common/ErrorState/ErrorState'
import { Loader } from '../../common/Loader/Loader'
import { Modal } from '../../common/Modal/Modal'
import styles from './StoryStatsModal.module.css'

export function StoryStatsModal({ storyId, open, onClose }) {
  const { data, loading, error, reload } = useAsync(
    async () => {
      const [stats, viewers] = await Promise.all([getStoryStats(storyId), getStoryViewers(storyId)])
      return { stats, viewers }
    },
    [storyId],
    { enabled: open && Boolean(storyId) },
  )

  return (
    <Modal open={open} onClose={onClose} title="Estatísticas do story">
      {loading && <Loader />}
      {error && <ErrorState error={error} onRetry={reload} compact />}
      {data && !loading && (
        <div className={styles.wrapper}>
          <dl className={styles.grid}>
            <div className={styles.stat}>
              <dt>Visualizações</dt>
              <dd>{data.stats?.views ?? 0}</dd>
            </div>
            <div className={styles.stat}>
              <dt>Logados</dt>
              <dd>{data.stats?.logged_views ?? 0}</dd>
            </div>
            <div className={styles.stat}>
              <dt>Visitantes</dt>
              <dd>{data.stats?.anonymous_views ?? 0}</dd>
            </div>
            <div className={styles.stat}>
              <dt>Curtidas</dt>
              <dd>{data.stats?.likes ?? 0}</dd>
            </div>
            <div className={styles.stat}>
              <dt>Comentários</dt>
              <dd>{data.stats?.comments ?? 0}</dd>
            </div>
          </dl>

          <h3 className={styles.subtitle}>Reações</h3>
          <ul className={styles.reactions} role="list">
            {STORY_REACTIONS.map(({ emoji, label }) => (
              <li key={emoji} className={styles.reaction} aria-label={`${label}: ${data.stats?.reactions?.[emoji] || 0}`}>
                <span aria-hidden="true">{emoji}</span>
                <strong>{data.stats?.reactions?.[emoji] || 0}</strong>
              </li>
            ))}
          </ul>

          <h3 className={styles.subtitle}>Quem viu ({data.viewers.length})</h3>
          {data.viewers.length === 0 ? (
            <EmptyState compact icon="eye" title="Nenhum usuário logado viu ainda" description="Visitantes contam apenas no total, sem identificação." />
          ) : (
            <ul className={styles.viewers} role="list">
              {data.viewers.map((v) => (
                <li key={v.viewer_id} className={styles.viewer}>
                  <Avatar src={v.avatar_url} name={v.full_name || v.username} size={36} />
                  <span className={styles.viewerName}>
                    <strong>{v.full_name || 'Sem nome'}</strong>
                    {v.username && <span>@{v.username}</span>}
                  </span>
                  <time dateTime={v.viewed_at}>{formatRelative(v.viewed_at)}</time>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </Modal>
  )
}
