import { useEffect, useMemo, useState } from 'react'

const API = import.meta.env.VITE_API_BASE || 'http://127.0.0.1:5000'

function BarRow({ label, value, max }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0
  return (
    <div style={{ display: 'grid', gap: 55 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700 }}>
        <span>{label}</span>
        <span>${value.toFixed(2)}</span>
      </div>
      <div style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid #2a2f3b', borderRadius: 8 }}>
        <div
          style={{
            width: `${pct}%`,
            height: 35,
            borderRadius: 20,
            background: 'linear-gradient(135deg, #8b5cf6, #06b6d4)',
            transition: 'width .4s ease'
          }}
        />
      </div>
    </div>
  )
}

function MiniBars({ data, labelKey, valueKey }) {
  const max = useMemo(() => Math.max(0, ...data.map(d => d[valueKey] || 0)), [data, valueKey])
  return (
    <div style={{ display: 'grid', gap: 12 }}>
      {data.map((d, i) => (
        <BarRow key={i} label={d[labelKey]} value={d[valueKey] || 0} max={max} />
      ))}
    </div>
  )
}

function Sparkline({ points }) {
  if (!points.length) return <div style={{ color: '#a1a1aa' }}>No data</div>
  const max = Math.max(...points.map(p => p.total))
  return (
    <div style={{ display: 'grid', gap: 8 }}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', height: 80 }}>
        {points.map((p, i) => {
          const h = max > 0 ? Math.round((p.total / max) * 80) : 0
        return (
          <div key={i} title={`${p.month}: $${p.total.toFixed(2)}`} style={{
            width: 24, height: h, background: 'linear-gradient(135deg, #8b5cf6, #06b6d4)', borderRadius: 4
          }}/>
        )})}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', color: '#a1a1aa', fontSize: 12 }}>
        {points.map((p, i) => <span key={i}>{p.month}</span>)}
      </div>
    </div>
  )
}

export default function Analytics({ username }) {
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState('')
  const [data, setData] = useState({ totals: { totalSpend: 0 }, byGroup: [], byPayer: [], monthly: [] })

  useEffect(() => {
    let live = true
    ;(async () => {
      setLoading(true); setErr('')
      try {
        const r = await fetch(`${API}/api/analytics/overview?user=${encodeURIComponent(username)}`)
        if (!r.ok) {
            const text = await r.text()
            throw new Error(`Failed to load analytics: ${text.substring(0, 100)}`)
        }
        const d = await r.json()
        if (!live) return
        setData(d)
      } catch (e) {
        if (!live) return
        setErr(String(e.message || e))
      } finally {
        if (live) setLoading(false)
      }
    })()
    return () => { live = false }
  }, [username])

  const currency = v => Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD' }).format(v || 0)

  if (loading) return <div className="page"><div className="panel">Loading analytics…</div></div>
  if (err) return <div className="page"><div className="panel">Error: {err}</div></div>

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="title">Analytics</h1>
          <p className="subtitle">Overview of your groups and spending</p>
        </div>
      </div>

      <div className="grid-3">
        <div className="kpi">
          <div className="kpi-label">Total Spend</div>
          <div className="kpi-value">{currency(data.totals.totalSpend)}</div>
        </div>
        <div className="kpi">
          <div className="kpi-label">Active Groups</div>
          <div className="kpi-value">{data.byGroup.length}</div>
        </div>
        <div className="kpi">
          <div className="kpi-label">Unique Payers</div>
          <div className="kpi-value">{data.byPayer.length}</div>
        </div>
      </div>

      <div className="grid-2">
        <div className="panel">
          <div className="panel-title">Monthly Spend (last 6)</div>
          <Sparkline points={data.monthly} />
        </div>

        <div className="panel">
          <div className="panel-title">Spend by Group</div>
          {data.byGroup.length ? (
            <MiniBars data={data.byGroup} labelKey="group" valueKey="total" />
          ) : <div className="empty">No group data</div>}
        </div>
      </div>

      <div className="panel">
        <div className="panel-title">Spend by Payer</div>
        {data.byPayer.length ? (
          <MiniBars data={data.byPayer} labelKey="payer" valueKey="total" />
        ) : <div className="empty">No payer data</div>}
      </div>
    </div>
  )
}