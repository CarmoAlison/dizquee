// Dashboard: métricas vindas de RPCs no banco (metrics.view).
// Sem essa permissão, mostra atalhos para os módulos liberados.
import { useState } from 'react'
import { Link } from 'react-router'
import { PERMISSIONS } from '../../../constants/permissions'
import { ROUTES } from '../../../constants/routes'
import { useAsync } from '../../../hooks/useAsync'
import { useAuth } from '../../../hooks/useAuth'
import { usePermission } from '../../../hooks/usePermission'
import {
  getMetricsSummary,
  getRecentActivity,
  getSignupsPerDay,
  getTopPosts,
  getTopStories,
} from '../../../services/metricsService'
import { formatCount, formatRelative, formatShortDay, formatLongDate } from '../../../utils/formatDate'
import { BarChart } from '../../../components/admin/BarChart/BarChart'
import { PageHeader } from '../../../components/admin/PageHeader/PageHeader'
import { StatCard } from '../../../components/admin/StatCard/StatCard'
import { EmptyState } from '../../../components/common/EmptyState/EmptyState'
import { ErrorState } from '../../../components/common/ErrorState/ErrorState'
import { Icon } from '../../../components/common/Icon/Icon'
import { SegmentedControl } from '../../../components/common/SegmentedControl/SegmentedControl'
import { Skeleton } from '../../../components/common/Skeleton/Skeleton'
import { ADMIN_NAV } from '../../../components/layout/AdminLayout/adminNav'
import shared from '../adminShared.module.css'
import styles from './Dashboard.module.css'

const ACTIVITY_TEXT = {
  signup: 'se cadastrou',
  post_like: 'curtiu',
  post_comment: 'comentou em',
  story_comment: 'comentou em um story',
}

export default function Dashboard() {
  const canMetrics = usePermission(PERMISSIONS.METRICS_VIEW)
  const { profile } = useAuth()
  const firstName = profile?.full_name?.split(' ')[0]
  return (
    <>
      <PageHeader title={firstName ? `Olá, ${firstName}!` : 'Painel'} description="Resumo do bloco e atalhos." />
      {canMetrics ? <Metrics /> : <Shortcuts />}
    </>
  )
}

function Shortcuts() {
  const { canAccessModule } = usePermission()
  const items = ADMIN_NAV.filter((i) => i.module && canAccessModule(i.module))
  if (!items.length) {
    return <EmptyState icon="shield" title="Nenhum módulo liberado" description="Peça à coordenação para ajustar seu perfil de acesso." />
  }
  return (
    <ul className={styles.shortcuts} role="list">
      {items.map((i) => (
        <li key={i.to}>
          <Link to={i.to} className={styles.shortcut}>
            <Icon name={i.icon} />
            {i.label}
          </Link>
        </li>
      ))}
    </ul>
  )
}

function Metrics() {
  const [days, setDays] = useState(30)
  const [topMetric, setTopMetric] = useState('likes')
  const summary = useAsync(getMetricsSummary, [])
  const signups = useAsync(() => getSignupsPerDay(days), [days])
  const topPosts = useAsync(() => getTopPosts(topMetric, 5), [topMetric])
  const topStories = useAsync(() => getTopStories(5), [])
  const activity = useAsync(() => getRecentActivity(15), [])

  const s = summary.data || {}
  const signupData = (signups.data || []).map((d) => ({
    label: formatShortDay(d.day),
    value: d.total,
    tooltip: formatLongDate(d.day),
  }))
  const totalPeriod = signupData.reduce((sum, d) => sum + d.value, 0)

  return (
    <div className={shared.stack}>
      {summary.error ? (
        <ErrorState error={summary.error} onRetry={summary.reload} compact />
      ) : (
        <div className={styles.stats}>
          {summary.loading
            ? [1, 2, 3, 4].map((i) => <Skeleton key={i} height={96} />)
            : [
                <StatCard key="u" label="Usuários" value={formatCount(s.total_users)} hint={`+${s.new_users_today || 0} hoje · +${s.new_users_7d || 0} em 7 dias`} icon="users" />,
                <StatCard key="p" label="Posts publicados" value={formatCount(s.published_posts)} hint={`${s.draft_posts || 0} rascunhos`} icon="posts" />,
                <StatCard key="i" label="Interações" value={formatCount((s.total_likes || 0) + (s.total_comments || 0))} hint={`${s.total_likes || 0} curtidas · ${s.total_comments || 0} comentários`} icon="heart" />,
                <StatCard key="s" label="Stories ativos" value={formatCount(s.active_stories)} hint={`${s.story_views_7d || 0} views em 7 dias`} icon="stories" />,
              ]}
        </div>
      )}

      <section className={shared.card} aria-labelledby="signups-title">
        <div className={styles.sectionHeader}>
          <div>
            <h2 id="signups-title" className={shared.cardTitle}>
              Novos cadastros por dia
            </h2>
            {!signups.loading && <p className={shared.muted}>{totalPeriod} no período</p>}
          </div>
          <SegmentedControl
            label="Período"
            value={days}
            onChange={setDays}
            options={[
              { value: 7, label: '7 dias' },
              { value: 30, label: '30 dias' },
              { value: 90, label: '90 dias' },
            ]}
          />
        </div>
        {signups.loading ? (
          <Skeleton height={180} />
        ) : signups.error ? (
          <ErrorState error={signups.error} onRetry={signups.reload} compact />
        ) : (
          <BarChart data={signupData} title={`Novos cadastros por dia nos últimos ${days} dias`} valueLabel="cadastros" />
        )}
      </section>

      <div className={styles.columns}>
        <section className={shared.card} aria-labelledby="top-posts">
          <div className={styles.sectionHeader}>
            <h2 id="top-posts" className={shared.cardTitle}>
              Posts em alta
            </h2>
            <SegmentedControl
              label="Ordenar por"
              value={topMetric}
              onChange={setTopMetric}
              options={[
                { value: 'likes', label: 'Curtidas' },
                { value: 'comments', label: 'Comentários' },
              ]}
            />
          </div>
          <RankList
            state={topPosts}
            empty="Nenhum post publicado ainda."
            render={(p) => (
              <>
                <Link to={ROUTES.POST(p.slug)} className={shared.rowTitle}>
                  {p.title}
                </Link>
                <span className={shared.rowMeta}>
                  {p.like_count} curtidas · {p.comment_count} comentários
                </span>
              </>
            )}
          />
        </section>

        <section className={shared.card} aria-labelledby="top-stories">
          <h2 id="top-stories" className={shared.cardTitle}>
            Stories mais vistos
          </h2>
          <RankList
            state={topStories}
            empty="Nenhum story ainda."
            render={(st) => (
              <>
                <span className={shared.rowTitle}>{st.caption || (st.media_type === 'video' ? 'Vídeo' : 'Imagem')}</span>
                <span className={shared.rowMeta}>
                  {st.view_count} views · {st.like_count} curtidas · {formatRelative(st.created_at)}
                  {st.is_highlight && ' · destaque'}
                </span>
              </>
            )}
          />
        </section>
      </div>

      <section className={shared.card} aria-labelledby="activity">
        <h2 id="activity" className={shared.cardTitle}>
          Atividade recente
        </h2>
        {activity.loading ? (
          <Skeleton height={160} />
        ) : activity.error ? (
          <ErrorState error={activity.error} onRetry={activity.reload} compact />
        ) : !activity.data?.length ? (
          <p className={shared.muted}>Sem atividade ainda.</p>
        ) : (
          <ul className={styles.activity} role="list">
            {activity.data.map((a, i) => (
              <li key={`${a.kind}-${a.actor_id}-${a.created_at}-${i}`}>
                <Link to={ROUTES.ADMIN_USER(a.actor_id)}>
                  <strong>{a.actor_name || a.actor_username || 'Usuário'}</strong>
                </Link>{' '}
                {ACTIVITY_TEXT[a.kind]}{' '}
                {a.target_slug ? <Link to={ROUTES.POST(a.target_slug)}>{a.target_title}</Link> : a.kind !== 'signup' && a.target_title ? `“${a.target_title}”` : ''}
                <span className={shared.rowMeta}> · {formatRelative(a.created_at)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}

function RankList({ state, render, empty }) {
  if (state.loading) return <Skeleton height={160} />
  if (state.error) return <ErrorState error={state.error} onRetry={state.reload} compact />
  if (!state.data?.length) return <p className={shared.muted}>{empty}</p>
  return (
    <ol className={styles.rank}>
      {state.data.map((item, i) => (
        <li key={item.id} className={styles.rankItem}>
          <span className={styles.rankNumber}>{i + 1}</span>
          <span className={shared.rowMain}>{render(item)}</span>
        </li>
      ))}
    </ol>
  )
}
