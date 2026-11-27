// Produtos da loja: lista, ordem na vitrine, ativar/desativar e excluir
import { Link } from 'react-router'
import { ROUTES } from '../../../constants/routes'
import { useAsync } from '../../../hooks/useAsync'
import { useToast } from '../../../hooks/useToast'
import { currentLot, listProducts, reorderProducts, setProductActive } from '../../../services/productsAdminService'
import { productImageUrl } from '../../../services/shopService'
import { cn } from '../../../utils/cn'
import { getErrorMessage } from '../../../utils/errors'
import { formatMoney } from '../../../utils/money'
import { PageHeader } from '../../../components/admin/PageHeader/PageHeader'
import { Button } from '../../../components/common/Button/Button'
import { EmptyState } from '../../../components/common/EmptyState/EmptyState'
import { ErrorState } from '../../../components/common/ErrorState/ErrorState'
import { Icon } from '../../../components/common/Icon/Icon'
import { Skeleton } from '../../../components/common/Skeleton/Skeleton'
import shared from '../adminShared.module.css'

export default function Products() {
  const toast = useToast()
  const { data, setData, loading, error, reload } = useAsync(listProducts, [])
  const products = data || []

  const move = async (index, dir) => {
    const list = [...products]
    const target = index + dir
    if (target < 0 || target >= list.length) return
    ;[list[index], list[target]] = [list[target], list[index]]
    setData(list)
    try {
      await reorderProducts(list)
    } catch (e) {
      toast.error(getErrorMessage(e, 'Não foi possível salvar a ordem.'))
      reload()
    }
  }

  const toggle = async (p) => {
    try {
      await setProductActive(p.id, !p.is_active)
      setData(products.map((x) => (x.id === p.id ? { ...x, is_active: !p.is_active } : x)))
      toast.success(p.is_active ? 'Produto escondido da loja.' : 'Produto visível na loja!')
    } catch (e) {
      toast.error(getErrorMessage(e))
    }
  }

  return (
    <>
      <PageHeader
        title="Produtos"
        description="Abadás, copos e kits. A ordem aqui é a ordem da vitrine."
        actions={
          <Button icon="plus" to={ROUTES.ADMIN_PRODUCT_NEW}>
            Novo produto
          </Button>
        }
      />

      {loading && <Skeleton height={240} />}
      {error && <ErrorState error={error} onRetry={reload} />}
      {!loading && !error && products.length === 0 && (
        <EmptyState
          icon="box"
          title="Nenhum produto ainda"
          description="Cadastre o primeiro: nome, fotos, variações (tamanhos), estoque e lotes de preço."
          action={
            <Button icon="plus" to={ROUTES.ADMIN_PRODUCT_NEW}>
              Novo produto
            </Button>
          }
        />
      )}

      {!loading && products.length > 0 && (
        <ul className={shared.list}>
          {products.map((p, i) => {
            const lot = currentLot(p.product_lots)
            const stock = p.product_variants.reduce((sum, v) => sum + (v.is_active ? v.stock : 0), 0)
            const cover = p.product_images[0]?.storage_path
            return (
              <li key={p.id} className={shared.row}>
                {cover ? (
                  <img src={productImageUrl(cover, { width: 120 })} alt="" className={shared.thumb} loading="lazy" />
                ) : (
                  <span className={shared.thumb}>
                    <Icon name="box" />
                  </span>
                )}
                <div className={shared.rowMain}>
                  <Link to={ROUTES.ADMIN_PRODUCT_EDIT(p.id)} className={shared.rowTitle}>
                    {p.name}
                  </Link>
                  <span className={shared.rowMeta}>
                    {lot ? `${lot.name}: ${formatMoney(lot.price)}` : 'Sem lote à venda'}
                    {' · '}
                    {p.kind === 'kit' ? `Kit com ${p.kit_items.length} item(ns)` : `Estoque: ${stock}`}
                  </span>
                </div>
                <div className={shared.rowActions}>
                  {p.kind === 'kit' && <span className={cn(shared.badge, shared.badgeAccent)}>Kit</span>}
                  <span className={cn(shared.badge, p.is_active ? shared.badgeSuccess : shared.badgeWarning)}>{p.is_active ? 'Na loja' : 'Oculto'}</span>
                  <Button variant="ghost" size="sm" iconOnly icon="chevronUp" aria-label={`Subir ${p.name}`} onClick={() => move(i, -1)} disabled={i === 0} />
                  <Button
                    variant="ghost"
                    size="sm"
                    iconOnly
                    icon="chevronDown"
                    aria-label={`Descer ${p.name}`}
                    onClick={() => move(i, 1)}
                    disabled={i === products.length - 1}
                  />
                  <Button variant="ghost" size="sm" icon={p.is_active ? 'eyeOff' : 'eye'} onClick={() => toggle(p)}>
                    {p.is_active ? 'Ocultar' : 'Mostrar'}
                  </Button>
                  <Button variant="secondary" size="sm" icon="edit" to={ROUTES.ADMIN_PRODUCT_EDIT(p.id)}>
                    Editar
                  </Button>
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </>
  )
}
