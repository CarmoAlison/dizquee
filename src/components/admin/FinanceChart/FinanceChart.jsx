// Entradas x saídas por período em barras agrupadas (SVG puro), com
// tooltip ao passar/tocar e tabela oculta para leitores de tela.
import { useState } from 'react'
import { formatMoney } from '../../../utils/money'
import styles from './FinanceChart.module.css'

const HEIGHT = 200
const PAD_TOP = 12
const PAD_BOTTOM = 24
const PAD_LEFT = 52

function niceMax(value) {
  if (value <= 10) return 10
  const pow = 10 ** Math.floor(Math.log10(value))
  return Math.ceil(value / pow) * pow
}

function compact(n) {
  return new Intl.NumberFormat('pt-BR', { notation: 'compact', maximumFractionDigits: 1 }).format(n)
}

/** data: [{ label, income, expense }] */
export function FinanceChart({ data, title = 'Entradas e saídas' }) {
  const [active, setActive] = useState(null)
  const max = niceMax(Math.max(0, ...data.flatMap((d) => [d.income, d.expense])))
  const width = 640
  const plotH = HEIGHT - PAD_TOP - PAD_BOTTOM
  const slot = (width - PAD_LEFT) / Math.max(1, data.length)
  const barW = Math.max(3, Math.min(12, slot * 0.34))
  const labelEvery = Math.ceil(data.length / 8)
  const y = (v) => PAD_TOP + plotH - (v / max) * plotH
  const current = active !== null ? data[active] : null

  return (
    <figure className={styles.figure}>
      <figcaption className={styles.legend}>
        <span className={styles.key}>
          <span className={`${styles.swatch} ${styles.income}`} /> Entradas
        </span>
        <span className={styles.key}>
          <span className={`${styles.swatch} ${styles.expense}`} /> Saídas
        </span>
        {current && (
          <span className={styles.tip} aria-live="polite">
            {current.label}: {formatMoney(current.income)} entrou · {formatMoney(current.expense)} saiu
          </span>
        )}
      </figcaption>
      <svg viewBox={`0 0 ${width} ${HEIGHT}`} className={styles.svg} role="img" aria-label={title} onMouseLeave={() => setActive(null)}>
        {[0, max / 2, max].map((t) => (
          <g key={t}>
            <line x1={PAD_LEFT} x2={width} y1={y(t)} y2={y(t)} className={styles.grid} />
            <text x={PAD_LEFT - 6} y={y(t) + 4} className={styles.axis} textAnchor="end">
              {compact(t)}
            </text>
          </g>
        ))}
        {data.map((d, i) => {
          const cx = PAD_LEFT + slot * i + slot / 2
          return (
            <g
              key={d.label + i}
              onMouseEnter={() => setActive(i)}
              onClick={() => setActive(i)}
              className={active === i ? styles.activeGroup : undefined}
            >
              <rect x={PAD_LEFT + slot * i} y={PAD_TOP} width={slot} height={plotH} className={styles.hit} />
              {d.income > 0 && <rect x={cx - barW - 1} y={y(d.income)} width={barW} height={Math.max(1, PAD_TOP + plotH - y(d.income))} rx={2} className={styles.income} />}
              {d.expense > 0 && <rect x={cx + 1} y={y(d.expense)} width={barW} height={Math.max(1, PAD_TOP + plotH - y(d.expense))} rx={2} className={styles.expense} />}
              {i % labelEvery === 0 && (
                <text x={cx} y={HEIGHT - 6} className={styles.axis} textAnchor="middle">
                  {d.label}
                </text>
              )}
            </g>
          )
        })}
      </svg>
      <table className="visually-hidden">
        <caption>{title}</caption>
        <thead>
          <tr>
            <th scope="col">Período</th>
            <th scope="col">Entradas</th>
            <th scope="col">Saídas</th>
          </tr>
        </thead>
        <tbody>
          {data.map((d, i) => (
            <tr key={d.label + i}>
              <th scope="row">{d.label}</th>
              <td>{formatMoney(d.income)}</td>
              <td>{formatMoney(d.expense)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  )
}
