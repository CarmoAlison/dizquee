// Gráfico de barras simples em SVG (uma série): barras finas com topo
// arredondado, grade discreta, tooltip ao passar/tocar e tabela oculta
// para leitores de tela.
import { useState } from 'react'
import styles from './BarChart.module.css'

const HEIGHT = 180
const PAD_TOP = 12
const PAD_BOTTOM = 24
const PAD_LEFT = 28

function niceMax(value) {
  if (value <= 4) return 4
  const pow = 10 ** Math.floor(Math.log10(value))
  return Math.ceil(value / pow) * pow
}

/** data: [{ label, value, tooltip? }] */
export function BarChart({ data, title, valueLabel = 'valor' }) {
  const [active, setActive] = useState(null)
  const max = niceMax(Math.max(0, ...data.map((d) => d.value)))
  const width = 600
  const plotH = HEIGHT - PAD_TOP - PAD_BOTTOM
  const slot = (width - PAD_LEFT) / Math.max(1, data.length)
  const barW = Math.max(4, Math.min(14, slot * 0.62))
  const ticks = [0, max / 2, max]
  const labelEvery = Math.ceil(data.length / 8)

  return (
    <figure className={styles.figure}>
      <div className={styles.chart} onMouseLeave={() => setActive(null)}>
        <svg viewBox={`0 0 ${width} ${HEIGHT}`} className={styles.svg} role="img" aria-label={title}>
          {ticks.map((t) => {
            const y = PAD_TOP + plotH - (t / max) * plotH
            return (
              <g key={t}>
                <line x1={PAD_LEFT} x2={width} y1={y} y2={y} className={styles.grid} />
                <text x={PAD_LEFT - 6} y={y + 4} className={styles.axisText} textAnchor="end">
                  {Math.round(t)}
                </text>
              </g>
            )
          })}
          {data.map((d, i) => {
            const h = (d.value / max) * plotH
            const x = PAD_LEFT + i * slot + (slot - barW) / 2
            const y = PAD_TOP + plotH - h
            const r = Math.min(4, barW / 2, h)
            return (
              <g key={d.label}>
                {/* área de toque maior que a barra */}
                <rect
                  x={PAD_LEFT + i * slot}
                  y={PAD_TOP}
                  width={slot}
                  height={plotH}
                  fill="transparent"
                  onMouseEnter={() => setActive(i)}
                  onClick={() => setActive(i)}
                />
                {h > 0 && (
                  <path
                    className={i === active ? styles.barActive : styles.bar}
                    d={`M${x},${y + h} V${y + r} Q${x},${y} ${x + r},${y} H${x + barW - r} Q${x + barW},${y} ${x + barW},${y + r} V${y + h} Z`}
                    pointerEvents="none"
                  />
                )}
                {i % labelEvery === 0 && (
                  <text x={x + barW / 2} y={HEIGHT - 6} className={styles.axisText} textAnchor="middle">
                    {d.label}
                  </text>
                )}
              </g>
            )
          })}
        </svg>
        {active !== null && data[active] && (
          <div
            className={styles.tooltip}
            style={{ left: `${((PAD_LEFT + active * slot + slot / 2) / width) * 100}%` }}
            role="status"
          >
            <strong>{data[active].value}</strong> {valueLabel}
            <span>{data[active].tooltip || data[active].label}</span>
          </div>
        )}
      </div>
      {/* tabela para leitores de tela (o div esconde; tabelas ignoram height: 1px) */}
      <div className="visually-hidden">
        <table>
          <caption>{title}</caption>
          <thead>
            <tr>
              <th scope="col">Dia</th>
              <th scope="col">{valueLabel}</th>
            </tr>
          </thead>
          <tbody>
            {data.map((d) => (
              <tr key={d.label}>
                <td>{d.tooltip || d.label}</td>
                <td>{d.value}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </figure>
  )
}
