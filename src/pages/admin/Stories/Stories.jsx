// Stories no admin: criar, filtrar (ativos/expirados/destaques), mover para
// destaque, excluir e ver estatísticas
import { useState } from 'react'
import { PERMISSIONS } from '../../../constants/permissions'
import { useAsync } from '../../../hooks/useAsync'
import { useAuth } from '../../../hooks/useAuth'
import { usePermission } from '../../../hooks/usePermission'
import { useToast } from '../../../hooks/useToast'
import { listHighlights } from '../../../services/highlightsService'
import { BUCKETS, getPublicUrl } from '../../../services/storageService'
import { deleteStory, listAdminStories, setStoryHighlight } from '../../../services/storiesService'
import { cn } from '../../../utils/cn'
import { getErrorMessage } from '../../../utils/errors'
import { formatDateTime, formatRelative } from '../../../utils/formatDate'
import { PageHeader } from '../../../components/admin/PageHeader/PageHeader'
import { Button } from '../../../components/common/Button/Button'
import { ConfirmDialog } from '../../../components/common/ConfirmDialog/ConfirmDialog'
import { EmptyState } from '../../../components/common/EmptyState/EmptyState'
import { ErrorState } from '../../../components/common/ErrorState/ErrorState'
import { Icon } from '../../../components/common/Icon/Icon'
import { Input } from '../../../components/common/Input/Input'
import { Modal } from '../../../components/common/Modal/Modal'
import { Pagination } from '../../../components/common/Pagination/Pagination'
import { SegmentedControl } from '../../../components/common/SegmentedControl/SegmentedControl'
import { Skeleton } from '../../../components/common/Skeleton/Skeleton'
import { StoryStatsModal } from '../../../components/stories/StoryStatsModal/StoryStatsModal'
import { StoryUploader } from '../../../components/stories/StoryUploader/StoryUploader'
import shared from '../adminShared.module.css'
import styles from './Stories.module.css'

const PAGE_SIZE = 24

function statusOf(story) {
  if (story.is_highlight) return { label: `Destaque${story.highlights?.title ? `: ${story.highlights.title}` : ''}`, cls: shared.badgeAccent }
  if (new Date(story.expires_at) > new Date()) return { label: `Expira ${formatRelative(story.expires_at).replace('há ', 'em ')}`, cls: shared.badgeSuccess }
  return { label: 'Expirado', cls: shared.badge }
}

export default function Stories() {
  const { user } = useAuth()
  const { has } = usePermission()
  const toast = useToast()
  const [filter, setFilter] = useState('active')
  const [page, setPage] = useState(0)
  const [uploaderOpen, setUploaderOpen] = useState(false)
  const [statsId, setStatsId] = useState(null)
  const [toDelete, setToDelete] = useState(null)
  const [toHighlight, setToHighlight] = useState(null)

  const { data, loading, error, reload } = useAsync(() => listAdminStories({ filter, page, pageSize: PAGE_SIZE }), [filter, page])
  const stories = data?.stories || []

  const canDelete = (s) => has(PERMISSIONS.STORIES_DELETE_ANY) || (s.author_id === user?.id && has(PERMISSIONS.STORIES_DELETE_OWN))

  return (
    <>
      <PageHeader
        title="Stories"
        description="Stories de 24 h somem do site sozinhos. Destaques ficam fixos."
        actions={
          has(PERMISSIONS.STORIES_CREATE) && (
            <Button icon="plus" onClick={() => setUploaderOpen(true)}>
              Novo story
            </Button>
          )
        }
      />

      <div className={shared.toolbar}>
        <SegmentedControl
          label="Filtro"
          value={filter}
          onChange={(v) => {
            setFilter(v)
            setPage(0)
          }}
          options={[
            { value: 'active', label: 'Ativos' },
            { value: 'highlights', label: 'Destaques' },
            { value: 'expired', label: 'Expirados' },
            { value: '', label: 'Todos' },
          ]}
        />
      </div>

      {loading && <Skeleton height={260} />}
      {error && <ErrorState error={error} onRetry={reload} />}
      {!loading && !error && stories.length === 0 && (
        <EmptyState icon="stories" title="Nenhum story aqui" description="Publique um story para aparecer na Home." />
      )}

      {!loading && stories.length > 0 && (
        <ul className={styles.grid}>
          {stories.map((s) => {
            const status = statusOf(s)
            const url = getPublicUrl(BUCKETS.STORY_MEDIA, s.storage_path)
            return (
              <li key={s.id} className={styles.card}>
                <div className={styles.media}>
                  {s.media_type === 'video' ? (
                    <video src={`${url}#t=0.1`} muted playsInline preload="metadata" aria-label={s.caption || 'Vídeo'} />
                  ) : (
                    <img src={url} alt={s.caption || 'Story'} loading="lazy" />
                  )}
                  <span className={cn(shared.badge, status.cls, styles.status)}>{status.label}</span>
                </div>
                <div className={styles.info}>
                  {s.caption && <p className={styles.caption}>{s.caption}</p>}
                  <p className={shared.rowMeta}>{formatDateTime(s.created_at)}</p>
                  <p className={styles.counters}>
                    <span title="Visualizações">
                      <Icon name="eye" size={14} /> {s.view_count}
                    </span>
                    <span title="Curtidas">
                      <Icon name="heart" size={14} /> {s.like_count}
                    </span>
                    <span title="Comentários">
                      <Icon name="comment" size={14} /> {s.comment_count}
                    </span>
                  </p>
                </div>
                <div className={styles.actions}>
                  {has(PERMISSIONS.STORIES_VIEW_STATS) && (
                    <Button variant="secondary" size="sm" icon="chart" onClick={() => setStatsId(s.id)}>
                      Estatísticas
                    </Button>
                  )}
                  {has(PERMISSIONS.STORIES_MANAGE_HIGHLIGHTS) && (
                    <Button variant="ghost" size="sm" iconOnly icon="star" aria-label="Mover para destaque" onClick={() => setToHighlight(s)} />
                  )}
                  {canDelete(s) && (
                    <Button variant="ghost" size="sm" iconOnly icon="trash" aria-label="Excluir story" onClick={() => setToDelete(s)} />
                  )}
                </div>
              </li>
            )
          })}
        </ul>
      )}

      <Pagination page={page} pageSize={PAGE_SIZE} total={data?.total || 0} onChange={setPage} />

      <StoryUploader
        open={uploaderOpen}
        onClose={() => setUploaderOpen(false)}
        onCreated={() => {
          setUploaderOpen(false)
          toast.success('Story publicado!')
          reload()
        }}
      />

      <StoryStatsModal storyId={statsId} open={Boolean(statsId)} onClose={() => setStatsId(null)} />

      {toHighlight && (
        <HighlightPicker
          story={toHighlight}
          onClose={() => setToHighlight(null)}
          onSaved={() => {
            setToHighlight(null)
            reload()
          }}
        />
      )}

      <ConfirmDialog
        open={Boolean(toDelete)}
        onClose={() => setToDelete(null)}
        onConfirm={async () => {
          await deleteStory(toDelete)
          toast.success('Story excluído.')
          reload()
        }}
        title="Excluir este story?"
        description="O arquivo, as curtidas, os comentários e as estatísticas serão apagados."
        confirmLabel="Excluir"
      />
    </>
  )
}

function HighlightPicker({ story, onClose, onSaved }) {
  const toast = useToast()
  const { data: highlights, loading } = useAsync(listHighlights, [])
  const [value, setValue] = useState(story.highlight_id || '')
  const [saving, setSaving] = useState(false)

  const save = async () => {
    setSaving(true)
    try {
      await setStoryHighlight(story.id, value || null)
      toast.success(value ? 'Story adicionado ao destaque.' : 'Story removido do destaque.')
      onSaved()
    } catch (e) {
      toast.error(getErrorMessage(e))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="Destaque do story"
      size="sm"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={save} loading={saving}>
            Salvar
          </Button>
        </>
      }
    >
      {loading ? (
        <Skeleton height={44} />
      ) : (
        <Input as="select" label="Coleção" value={value} onChange={(e) => setValue(e.target.value)} hint="Sem destaque, o story volta a contar como expirado.">
          <option value="">Sem destaque</option>
          {(highlights || []).map((h) => (
            <option key={h.id} value={h.id}>
              {h.title}
            </option>
          ))}
        </Input>
      )}
    </Modal>
  )
}
