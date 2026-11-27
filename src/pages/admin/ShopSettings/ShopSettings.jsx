// Configurações da loja: aberta/fechada, WhatsApp do bloco, retirada e aviso
import { useState } from 'react'
import { useAsync } from '../../../hooks/useAsync'
import { useToast } from '../../../hooks/useToast'
import { getShopSettings, updateShopSettings } from '../../../services/shopService'
import { getErrorMessage } from '../../../utils/errors'
import { formatPhone, normalizePhone, validatePhone } from '../../../utils/validators'
import { whatsappLink } from '../../../utils/whatsapp'
import { PageHeader } from '../../../components/admin/PageHeader/PageHeader'
import { Button } from '../../../components/common/Button/Button'
import { Checkbox } from '../../../components/common/Checkbox/Checkbox'
import { ErrorState } from '../../../components/common/ErrorState/ErrorState'
import { Input } from '../../../components/common/Input/Input'
import { Skeleton } from '../../../components/common/Skeleton/Skeleton'
import shared from '../adminShared.module.css'

export default function ShopSettings() {
  const { data, loading, error, reload } = useAsync(getShopSettings, [])
  return (
    <>
      <PageHeader title="Configurações da loja" description="Como os clientes falam com o bloco e onde retiram os pedidos." />
      {loading && <Skeleton height={320} />}
      {error && <ErrorState error={error} onRetry={reload} />}
      {data && <SettingsForm key={data.updated_at} settings={data} onSaved={reload} />}
    </>
  )
}

function SettingsForm({ settings, onSaved }) {
  const toast = useToast()
  const [values, setValues] = useState({
    is_open: settings.is_open,
    whatsapp: formatPhone(settings.whatsapp_number) || '',
    pickup_info: settings.pickup_info || '',
    notice: settings.notice || '',
  })
  const [errors, setErrors] = useState({})
  const [saving, setSaving] = useState(false)
  const set = (key, value) => setValues((v) => ({ ...v, [key]: value }))

  const submit = async (e) => {
    e.preventDefault()
    const next = { whatsapp: values.whatsapp ? validatePhone(values.whatsapp) : '' }
    setErrors(next)
    if (next.whatsapp) return
    setSaving(true)
    try {
      await updateShopSettings({
        is_open: values.is_open,
        whatsapp_number: values.whatsapp ? normalizePhone(values.whatsapp) : null,
        pickup_info: values.pickup_info,
        notice: values.notice,
      })
      toast.success('Configurações salvas!')
      onSaved()
    } catch (err) {
      toast.error(getErrorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  const testLink = values.whatsapp && !validatePhone(values.whatsapp) ? whatsappLink(normalizePhone(values.whatsapp), 'Teste do site') : ''

  return (
    <form className={`${shared.card} ${shared.stack}`} onSubmit={submit} noValidate>
      <Checkbox
        label="Loja aberta para pedidos"
        description="Fechada, os clientes veem os produtos, mas não conseguem fazer pedidos."
        checked={values.is_open}
        onChange={(e) => set('is_open', e.target.checked)}
      />
      <Input
        label="WhatsApp do bloco"
        type="tel"
        value={values.whatsapp}
        onChange={(e) => set('whatsapp', e.target.value)}
        error={errors.whatsapp}
        hint="Para onde o cliente manda o pedido. Ex.: (11) 91234-5678"
      />
      {testLink && (
        <div>
          <Button href={testLink} target="_blank" rel="noopener noreferrer" variant="ghost" size="sm" icon="whatsapp">
            Testar o link
          </Button>
        </div>
      )}
      <Input
        as="textarea"
        label="Retirada (local, datas e horários)"
        value={values.pickup_info}
        onChange={(e) => set('pickup_info', e.target.value)}
        maxLength={1000}
        hint="Aparece no carrinho e nos pedidos pagos."
      />
      <Input
        label="Aviso na loja (opcional)"
        value={values.notice}
        onChange={(e) => set('notice', e.target.value)}
        maxLength={300}
        hint="Ex.: 2º lote começa sexta-feira!"
      />
      <div>
        <Button type="submit" icon="check" loading={saving}>
          Salvar
        </Button>
      </div>
    </form>
  )
}
