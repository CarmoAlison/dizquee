// Clientes: quem se cadastrou e quando, com busca e filtros
import { useState } from 'react'
import { Link } from 'react-router'
import { ROUTES } from '../../../constants/routes'
import { useAsync } from '../../../hooks/useAsync'
import { useDebounce } from '../../../hooks/useDebounce'
import { listUsers } from '../../../services/usersService'
import { cn } from '../../../utils/cn'
import { formatDateTime } from '../../../utils/formatDate'
import { formatPhone } from '../../../utils/validators'
import { PageHeader } from '../../../components/admin/PageHeader/PageHeader'
import { Avatar } from '../../../components/common/Avatar/Avatar'
import { EmptyState } from '../../../components/common/EmptyState/EmptyState'
import { ErrorState } from '../../../components/common/ErrorState/ErrorState'
import { Input } from '../../../components/common/Input/Input'
import { Pagination } from '../../../components/common/Pagination/Pagination'
import { Skeleton } from '../../../components/common/Skeleton/Skeleton'
import shared from '../adminShared.module.css'

const PAGE_SIZE = 25

export default function Users() {
  const [filters, setFilters] = useState({ search: '', status: '', type: 'clients', from: '', to: '' })
  const [page, setPage] = useState(0)
  const search = useDebounce(filters.search, 400)
  const { data, loading, error, reload } = useAsync(
    () => listUsers({ ...filters, search, page, pageSize: PAGE_SIZE }),
    [search, filters.status, filters.type, filters.from, filters.to, page],
  )
  const set = (key) => (e) => {
    setFilters((f) => ({ ...f, [key]: e.target.value }))
    setPage(0)
  }
  const users = data?.users || []

  return (
    <>
      <PageHeader title="Clientes" description={data ? `${data.total} pessoa(s) encontradas` : 'Quem se cadastrou e quando.'} />

      <div className={shared.toolbar}>
        <Input label="Buscar" type="search" placeholder="Nome, @usuário, e-mail ou telefone" value={filters.search} onChange={set('search')} />
        <Input as="select" label="Tipo" value={filters.type} onChange={set('type')}>
          <option value="clients">Clientes</option>
          <option value="staff">Equipe</option>
          <option value="all">Todos</option>
        </Input>
        <Input as="select" label="Status" value={filters.status} onChange={set('status')}>
          <option value="">Todos</option>
          <option value="active">Ativos</option>
          <option value="banned">Banidos</option>
          <option value="incomplete">Cadastro incompleto</option>
        </Input>
        <Input label="Cadastrados de" type="date" value={filters.from} onChange={set('from')} />
        <Input label="até" type="date" value={filters.to} onChange={set('to')} />
      </div>

      {loading && <Skeleton height={300} />}
      {error && <ErrorState error={error} onRetry={reload} />}
      {!loading && !error && users.length === 0 && <EmptyState icon="users" title="Ninguém encontrado" description="Ajuste a busca ou os filtros." />}

      {!loading && users.length > 0 && (
        <ul className={shared.list}>
          {users.map((u) => (
            <li key={u.id} className={shared.row}>
              <Avatar src={u.avatar_url} name={u.full_name || u.username} size={44} />
              <div className={shared.rowMain}>
                <Link to={ROUTES.ADMIN_USER(u.id)} className={shared.rowTitle}>
                  {u.full_name || 'Sem nome'} {u.username && <span className={shared.rowMeta}>@{u.username}</span>}
                </Link>
                <span className={shared.rowMeta}>
                  {u.email || formatPhone(u.phone) || '—'} · cadastro em {formatDateTime(u.created_at)}
                </span>
              </div>
              <div className={shared.rowActions}>
                {u.is_staff && <span className={cn(shared.badge, shared.badgeAccent)}>Equipe</span>}
                {u.is_banned && <span className={cn(shared.badge, shared.badgeDanger)}>Banido</span>}
                {(!u.username || !u.terms_accepted_at) && <span className={cn(shared.badge, shared.badgeWarning)}>Incompleto</span>}
              </div>
            </li>
          ))}
        </ul>
      )}

      <Pagination page={page} pageSize={PAGE_SIZE} total={data?.total || 0} onChange={setPage} />
    </>
  )
}
