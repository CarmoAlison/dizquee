// Vitrine da loja: produtos ativos com o preço do lote vigente
import { useAsync } from '../../../hooks/useAsync'
import { useBrand } from '../../../hooks/useBrand'
import { useDocumentTitle } from '../../../hooks/useDocumentTitle'
import { getCatalog, getShopSettings } from '../../../services/shopService'
import { EmptyState } from '../../../components/common/EmptyState/EmptyState'
import { ErrorState } from '../../../components/common/ErrorState/ErrorState'
import { Icon } from '../../../components/common/Icon/Icon'
import { Skeleton } from '../../../components/common/Skeleton/Skeleton'
import { WaveDivider } from '../../../components/layout/WaveDivider/WaveDivider'
import { ProductCard } from '../../../components/shop/ProductCard/ProductCard'
import shop from '../shop.module.css'

export default function Shop() {
  const { name } = useBrand()
  useDocumentTitle('Loja', { description: `Abadás, copos e kits do ${name}.` })
  const catalog = useAsync(getCatalog, [])
  const settings = useAsync(getShopSettings, [])
  const products = catalog.data || []

  return (
    <>
      <section className={shop.hero}>
        <div className={`container ${shop.heroInner}`}>
          <h1 className={shop.heroTitle}>Loja</h1>
          <p className={shop.heroText}>Garanta seu abadá, copo e kit. Você faz o pedido aqui e combina o pagamento pelo WhatsApp.</p>
        </div>
        <WaveDivider color="var(--color-bg)" height={28} className={shop.wave} />
      </section>

      <div className={`container ${shop.page}`}>
        {settings.data && !settings.data.is_open && (
          <p className={shop.notice} role="status">
            <Icon name="alert" size={18} />
            A loja está fechada para novos pedidos no momento. Dá para olhar os produtos à vontade.
          </p>
        )}
        {settings.data?.notice && (
          <p className={shop.notice}>
            <Icon name="star" size={18} />
            {settings.data.notice}
          </p>
        )}

        {catalog.loading && (
          <div className={shop.grid} aria-busy="true">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} height={260} />
            ))}
          </div>
        )}
        {catalog.error && <ErrorState error={catalog.error} onRetry={catalog.reload} />}
        {!catalog.loading && !catalog.error && products.length === 0 && (
          <EmptyState icon="bag" title="Nenhum produto por enquanto" description="Volte em breve: abadás e kits aparecem aqui assim que forem lançados." />
        )}
        {!catalog.loading && products.length > 0 && (
          <div className={shop.grid}>
            {products.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        )}
      </div>
    </>
  )
}
