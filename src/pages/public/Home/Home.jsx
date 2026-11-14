// Home: banner, stories, filtros por categoria e feed com scroll infinito
import { useMemo, useState } from 'react'
import { useBrand } from '../../../hooks/useBrand'
import { useSearchParams } from 'react-router'
import { ROUTES } from '../../../constants/routes'
import { SEO } from '../../../constants/brand'
import { useAuth } from '../../../hooks/useAuth'
import { useCategories } from '../../../hooks/useCategories'
import { useDocumentTitle } from '../../../hooks/useDocumentTitle'
import { usePosts } from '../../../hooks/usePosts'
import { useStories } from '../../../hooks/useStories'
import { Button } from '../../../components/common/Button/Button'
import { WaveDivider } from '../../../components/layout/WaveDivider/WaveDivider'
import { SignupInvite } from '../../../components/layout/SignupInvite/SignupInvite'
import { CategoryChips } from '../../../components/posts/CategoryChips/CategoryChips'
import { PostList } from '../../../components/posts/PostList/PostList'
import { StoriesBar } from '../../../components/stories/StoriesBar/StoriesBar'
import { StoryViewer } from '../../../components/stories/StoryViewer/StoryViewer'
import styles from './Home.module.css'

export default function Home() {
  useDocumentTitle(null, { description: SEO.description })
  const brand = useBrand()
  const { profile, isAuthenticated, loading: authLoading } = useAuth()
  const [params, setParams] = useSearchParams()
  const slug = params.get('categoria')
  const { categories, loading: categoriesLoading } = useCategories()
  const selected = categories.find((c) => c.slug === slug) || null
  const waitingCategory = Boolean(slug) && categoriesLoading
  const { posts, loading, error, hasMore, loadMore, reload, updatePost } = usePosts(selected?.id ?? null, {
    // espera a sessão para já trazer as curtidas do usuário (evita buscar duas vezes)
    enabled: !waitingCategory && !authLoading,
  })
  const stories = useStories()
  const [viewerGroup, setViewerGroup] = useState(null)

  const categoriesById = useMemo(() => Object.fromEntries(categories.map((c) => [c.id, c])), [categories])

  const selectCategory = (newSlug) => {
    const next = new URLSearchParams(params)
    if (newSlug) next.set('categoria', newSlug)
    else next.delete('categoria')
    setParams(next, { replace: true })
  }

  const firstName = profile?.full_name?.split(' ')[0]

  return (
    <div className={styles.page}>
      <section className={styles.hero} aria-labelledby="home-title">
        <div className={`container ${styles.heroInner}`}>
          <span className={styles.heroEyebrow}>{brand.shortName}</span>
          <h1 id="home-title" className={styles.heroTitle}>
            {isAuthenticated && firstName ? `Olá, ${firstName}!` : `Bem-vindo ao ${brand.name}`}
          </h1>
          <p className={styles.heroText}>{brand.tagline}</p>
          {!isAuthenticated && !authLoading && (
            <div className={styles.heroActions}>
              <Button to={ROUTES.REGISTER} className={styles.heroPrimary}>
                Criar conta grátis
              </Button>
              <Button to={ROUTES.LOGIN} variant="ghost" className={styles.heroGhost}>
                Já tenho conta
              </Button>
            </div>
          )}
        </div>
        <WaveDivider color="var(--color-bg)" height={28} className={styles.heroWave} />
      </section>

      <div className={`container ${styles.layout}`}>
        <div className={styles.feed}>
          <StoriesBar groups={stories.groups} loading={stories.loading} onOpen={setViewerGroup} className={styles.stories} />

          <CategoryChips categories={categories} selected={slug} onSelect={selectCategory} loading={categoriesLoading} />

          {slug && !categoriesLoading && !selected ? (
            <p className={styles.notice}>
              Categoria não encontrada.{' '}
              <Button variant="ghost" size="sm" onClick={() => selectCategory(null)}>
                Ver todas
              </Button>
            </p>
          ) : (
            <PostList
              posts={posts}
              loading={loading || waitingCategory || authLoading}
              error={error}
              hasMore={hasMore}
              onLoadMore={loadMore}
              onRetry={reload}
              onUpdate={updatePost}
              categoriesById={categoriesById}
              emptyAction={
                slug ? (
                  <Button variant="secondary" onClick={() => selectCategory(null)}>
                    Ver todas as categorias
                  </Button>
                ) : null
              }
            />
          )}
        </div>

        <aside className={styles.sidebar} aria-label="Informações">
          <SignupInvite variant="card" />
          {categories.length > 0 && (
            <div className={styles.sideCard}>
              <h2 className={styles.sideTitle}>Categorias</h2>
              <ul className={styles.sideList} role="list">
                {categories.map((c) => (
                  <li key={c.id}>
                    <button type="button" className={styles.sideLink} onClick={() => selectCategory(c.slug)} aria-pressed={slug === c.slug}>
                      {c.color && <span className={styles.dot} style={{ background: c.color }} aria-hidden="true" />}
                      {c.name}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </aside>
      </div>

      {viewerGroup !== null && stories.groups[viewerGroup] && (
        <StoryViewer
          groups={stories.groups}
          startGroup={viewerGroup}
          onClose={() => setViewerGroup(null)}
          onSeen={stories.markSeen}
        />
      )}
    </div>
  )
}
