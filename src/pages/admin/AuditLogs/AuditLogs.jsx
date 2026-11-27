// Log de auditoria: quem fez o quê, com filtros
import { useState } from 'react'
import { ORDER_STATUS } from '../../../constants/orders'
import { useAsync } from '../../../hooks/useAsync'
import { useDebounce } from '../../../hooks/useDebounce'
import { listAuditLogs } from '../../../services/auditService'
import { formatDateTime } from '../../../utils/formatDate'
import { PageHeader } from '../../../components/admin/PageHeader/PageHeader'
import { Avatar } from '../../../components/common/Avatar/Avatar'
import { EmptyState } from '../../../components/common/EmptyState/EmptyState'
import { ErrorState } from '../../../components/common/ErrorState/ErrorState'
import { Input } from '../../../components/common/Input/Input'
import { Pagination } from '../../../components/common/Pagination/Pagination'
import { Skeleton } from '../../../components/common/Skeleton/Skeleton'
import shared from '../adminShared.module.css'

const PAGE_SIZE = 30

const ACTION_LABELS = {
  'post.create': 'criou o post',
  'post.update': 'editou o post',
  'post.delete': 'excluiu o post',
  'post.publish': 'publicou o post',
  'post.unpublish': 'despublicou o post',
  'category.create': 'criou a categoria',
  'category.update': 'editou a categoria',
  'category.delete': 'excluiu a categoria',
  'story.create': 'publicou um story',
  'story.update': 'alterou um story',
  'story.delete': 'excluiu um story',
  'highlight.create': 'criou o destaque',
  'highlight.update': 'editou o destaque',
  'highlight.delete': 'excluiu o destaque',
  'role.create': 'criou o perfil',
  'role.update': 'editou o perfil',
  'role.delete': 'excluiu o perfil',
  'role.grant_permission': 'concedeu permissão ao perfil',
  'role.revoke_permission': 'removeu permissão do perfil',
  'user.ban': 'baniu',
  'user.unban': 'desbaniu',
  'staff.create': 'adicionou à equipe',
  'staff.add': 'colocou na equipe',
  'staff.remove': 'removeu da equipe',
  'staff.activate': 'ativou o acesso de',
  'staff.deactivate': 'desativou o acesso de',
  'staff.change_role': 'trocou o perfil de',
  'comment.delete': 'excluiu o comentário',
  'story_comment.delete': 'excluiu o comentário de story',
  'product.create': 'criou o produto',
  'product.update': 'editou o produto',
  'product.delete': 'excluiu o produto',
  'product_variant.create': 'criou a variação',
  'product_variant.update': 'editou a variação (ou o estoque)',
  'product_variant.delete': 'excluiu a variação',
  'product_lot.create': 'criou o lote',
  'product_lot.update': 'editou o lote',
  'product_lot.delete': 'excluiu o lote',
  'shop_settings.update': 'alterou as configurações da loja',
  'order.status': 'mudou o status do pedido',
  'purchase.create': 'registrou a compra de',
  'purchase.delete': 'excluiu a compra de',
  'supplier.create': 'cadastrou o fornecedor',
  'supplier.update': 'editou o fornecedor',
  'supplier.delete': 'excluiu o fornecedor',
  'stock.adjust': 'ajustou o estoque de',
  'finance_entry.insert': 'lançou',
  'finance_entry.update': 'alterou o lançamento',
  'finance_entry.delete': 'excluiu o lançamento',
  'finance_category.create': 'criou a categoria financeira',
  'finance_category.update': 'editou a categoria financeira',
  'finance_category.delete': 'excluiu a categoria financeira',
}

const ENTITIES = [
  { value: '', label: 'Todas' },
  { value: 'post', label: 'Posts' },
  { value: 'category', label: 'Categorias' },
  { value: 'story', label: 'Stories' },
  { value: 'highlight', label: 'Destaques' },
  { value: 'role', label: 'Perfis de acesso' },
  { value: 'user', label: 'Usuários e equipe' },
  { value: 'comment', label: 'Comentários' },
  { value: 'product', label: 'Produtos' },
  { value: 'product_variant', label: 'Variações e estoque' },
  { value: 'product_lot', label: 'Lotes' },
  { value: 'order', label: 'Pedidos' },
  { value: 'shop_settings', label: 'Configurações da loja' },
  { value: 'purchase', label: 'Compras' },
  { value: 'supplier', label: 'Fornecedores' },
  { value: 'finance_entry', label: 'Lançamentos financeiros' },
  { value: 'finance_category', label: 'Categorias financeiras' },
]

function details(log) {
  const m = log.metadata || {}
  const parts = []
  if (log.action === 'order.status') {
    parts.push(`novo status: ${ORDER_STATUS[m.to]?.label || m.to}`)
    if (m.note) parts.push(m.note)
    return parts.join(' · ')
  }
  if (log.action === 'stock.adjust') {
    parts.push(`${m.delta > 0 ? '+' : ''}${m.delta} un.`)
    if (m.note) parts.push(m.note)
    return parts.join(' · ')
  }
  if (m.permission) parts.push(m.permission)
  if (m.reason) parts.push(`motivo: ${m.reason}`)
  if (m.from !== undefined || m.to !== undefined) parts.push(`${m.from || 'sem perfil'} → ${m.to || 'sem perfil'}`)
  if (m.role) parts.push(`perfil: ${m.role}`)
  return parts.join(' · ')
}

export default function AuditLogs() {
  const [filters, setFilters] = useState({ entity: '', action: '', search: '', from: '', to: '' })
  const [page, setPage] = useState(0)
  const search = useDebounce(filters.search, 400)
  const { data, loading, error, reload } = useAsync(
    () => listAuditLogs({ ...filters, search, page, pageSize: PAGE_SIZE }),
    [filters.entity, filters.action, search, filters.from, filters.to, page],
  )
  const set = (key) => (e) => {
    setFilters((f) => ({ ...f, [key]: e.target.value }))
    setPage(0)
  }
  const logs = data?.logs || []

  return (
    <>
      <PageHeader title="Auditoria" description="Registro automático das ações administrativas." />

      <div className={shared.toolbar}>
        <Input as="select" label="Área" value={filters.entity} onChange={set('entity')}>
          {ENTITIES.map((e) => (
            <option key={e.value} value={e.value}>
              {e.label}
            </option>
          ))}
        </Input>
        <Input as="select" label="Ação" value={filters.action} onChange={set('action')}>
          <option value="">Todas</option>
          {Object.entries(ACTION_LABELS).map(([key, label]) => (
            <option key={key} value={key}>
              {label} ({key})
            </option>
          ))}
        </Input>
        <Input label="Buscar item" type="search" value={filters.search} onChange={set('search')} />
        <Input label="De" type="date" value={filters.from} onChange={set('from')} />
        <Input label="Até" type="date" value={filters.to} onChange={set('to')} />
      </div>

      {loading && <Skeleton height={300} />}
      {error && <ErrorState error={error} onRetry={reload} />}
      {!loading && !error && logs.length === 0 && <EmptyState icon="list" title="Nenhum registro encontrado" />}

      {!loading && logs.length > 0 && (
        <ul className={shared.list}>
          {logs.map((log) => (
            <li key={log.id} className={shared.row}>
              <Avatar src={log.actor?.avatar_url} name={log.actor?.full_name || 'Sistema'} size={36} />
              <div className={shared.rowMain}>
                <span>
                  <strong>{log.actor?.full_name || log.actor?.username || 'Sistema'}</strong> {ACTION_LABELS[log.action] || log.action}{' '}
                  {log.metadata?.label && <strong>“{log.metadata.label}”</strong>}
                </span>
                <span className={shared.rowMeta}>
                  {formatDateTime(log.created_at)} · {log.action}
                  {details(log) && ` · ${details(log)}`}
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}

      <Pagination page={page} pageSize={PAGE_SIZE} total={data?.total || 0} onChange={setPage} />
    </>
  )
}
