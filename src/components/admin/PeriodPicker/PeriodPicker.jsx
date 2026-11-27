// Período dos relatórios: atalhos (este mês, últimos 30 dias...) ou datas livres
import { PERIOD_PRESETS, presetRange } from '../../../utils/period'
import { Input } from '../../common/Input/Input'
import { SegmentedControl } from '../../common/SegmentedControl/SegmentedControl'
import styles from './PeriodPicker.module.css'

/** value: { preset, from, to } */
export function PeriodPicker({ value, onChange }) {
  return (
    <div className={styles.picker}>
      <SegmentedControl
        label="Período"
        options={[...Object.entries(PERIOD_PRESETS).map(([key, p]) => ({ value: key, label: p.label })), { value: 'custom', label: 'Escolher datas' }]}
        value={value.preset}
        onChange={(preset) => onChange(preset === 'custom' ? { ...value, preset } : { preset, ...presetRange(preset) })}
      />
      {value.preset === 'custom' && (
        <div className={styles.dates}>
          <Input label="De" type="date" value={value.from} max={value.to} onChange={(e) => e.target.value && onChange({ ...value, from: e.target.value })} />
          <Input label="Até" type="date" value={value.to} min={value.from} onChange={(e) => e.target.value && onChange({ ...value, to: e.target.value })} />
        </div>
      )}
    </div>
  )
}
