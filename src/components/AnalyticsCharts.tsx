import type { ProcessedLead } from '../types';
import {
  PieChart, Pie, Cell,
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer,
  LineChart, Line, BarChart, Bar
} from 'recharts';
import { CheckCircle, XCircle, TrendingUp, Users, Target, Percent } from 'lucide-react';

interface AnalyticsChartsProps {
  data: ProcessedLead[];
}

const COLORS = { Si: '#10b981', No: '#ef4444' };

export function AnalyticsCharts({ data }: AnalyticsChartsProps) {
  if (!data.length) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', gap: '1rem', color: 'var(--text-muted)' }}>
        <Target size={56} strokeWidth={1.5} color="var(--accent-orange)" />
        <h3 style={{ color: 'white' }}>Sin datos todavía</h3>
        <p>Ve a <strong style={{ color: 'var(--accent-orange)' }}>Predicción Masiva</strong> y sube un archivo CSV para ver las analíticas aquí.</p>
      </div>
    );
  }

  const siCount = data.filter(d => d.prediction?.status === 'Sí').length;
  const noCount = data.filter(d => d.prediction?.status === 'No').length;
  const total     = data.length;

  const avgProb = (data.reduce((acc, c) => acc + (c.prediction?.probability || 0), 0) / total).toFixed(1);
  const convRate = ((siCount / total) * 100).toFixed(1);

  // Probability distribution buckets
  const buckets = { '0-20%': 0, '21-40%': 0, '41-60%': 0, '61-80%': 0, '81-100%': 0 };
  data.forEach(d => {
    const p = d.prediction?.probability || 0;
    if (p <= 20)      buckets['0-20%']++;
    else if (p <= 40) buckets['21-40%']++;
    else if (p <= 60) buckets['41-60%']++;
    else if (p <= 80) buckets['61-80%']++;
    else              buckets['81-100%']++;
  });
  const areaData = Object.entries(buckets).map(([name, uv]) => ({ name, uv }));

  // Pie
  const pieData = [
    { name: 'Sí',  value: siCount,  color: COLORS.Si  },
    { name: 'No',  value: noCount,  color: COLORS.No },
  ];

  // Top 5 Si leads
  const topSi = [...data]
    .filter(d => d.prediction?.status === 'Sí')
    .sort((a, b) => (b.prediction?.probability || 0) - (a.prediction?.probability || 0))
    .slice(0, 5);

  // Entidad breakdown
  const entidadMap: Record<string, number> = {};
  data.forEach(d => {
    const p = d.tipo_entidad_interes || 'Desconocido';
    entidadMap[p] = (entidadMap[p] || 0) + 1;
  });
  const entidadData = Object.entries(entidadMap)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([name, count]) => ({ name, count }));

  // Sparklines
  const spark = (len: number) => Array.from({ length: len }, (_, i) => ({ v: Math.random() * 10 + i }));

  return (
    <div className="animate-fade-in">

      {/* KPI Row */}
      <div className="kpi-grid">
        <div className="glass-panel kpi-card">
          <div className="kpi-title"><Users size={13} style={{ display: 'inline', marginRight: 4 }} />Total Leads</div>
          <div className="kpi-content">
            <div className="kpi-value glow-blue">{total}</div>
            <div style={{ width: 60, height: 30 }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={spark(6)}><Line type="monotone" dataKey="v" stroke="#60a5fa" strokeWidth={2} dot={false} /></LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        <div className="glass-panel kpi-card">
          <div className="kpi-title"><CheckCircle size={13} style={{ display: 'inline', marginRight: 4 }} />Leads 'Sí'</div>
          <div className="kpi-content">
            <div className="kpi-value glow-green" style={{color: '#10b981'}}>{siCount}</div>
            <div style={{ width: 60, height: 30 }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={spark(6)}><Line type="monotone" dataKey="v" stroke="#10b981" strokeWidth={2} dot={false} /></LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        <div className="glass-panel kpi-card">
          <div className="kpi-title"><Percent size={13} style={{ display: 'inline', marginRight: 4 }} />Probabilidad Media</div>
          <div className="kpi-content">
            <div className="kpi-value glow-yellow">{avgProb}%</div>
            <div style={{ width: 60, height: 30 }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={spark(6)}><Line type="monotone" dataKey="v" stroke="#fbbf24" strokeWidth={2} dot={false} /></LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        <div className="glass-panel kpi-card">
          <div className="kpi-title"><TrendingUp size={13} style={{ display: 'inline', marginRight: 4 }} />Tasa de Conversión</div>
          <div className="kpi-content">
            <div className="kpi-value glow-green">{convRate}%</div>
            <div style={{ width: 60, height: 30 }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={spark(6)}><Line type="monotone" dataKey="v" stroke="#34d399" strokeWidth={2} dot={false} /></LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </div>

      {/* Middle Row */}
      <div className="chart-grid">
        {/* Distribution Area Chart */}
        <div className="glass-panel chart-card">
          <div className="chart-header">Distribución de Probabilidades de Compra</div>
          <div style={{ height: 240 }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={areaData} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#10b981" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: 'var(--text-muted)', fontSize: 10 }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: 'var(--text-muted)', fontSize: 10 }} />
                <RechartsTooltip
                  contentStyle={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: 8 }}
                  labelStyle={{ color: 'white' }}
                  itemStyle={{ color: '#10b981' }}
                />
                <Area type="monotone" dataKey="uv" stroke="#10b981" strokeWidth={3} fillOpacity={1} fill="url(#areaGrad)" name="Leads" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Pie Chart */}
        <div className="glass-panel chart-card">
          <div className="chart-header">Clasificación de Leads</div>
          <div style={{ display: 'flex', alignItems: 'center', height: 240 }}>
            <div style={{ flex: 1 }}>
              {pieData.map((d, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                  <span style={{ width: 10, height: 10, borderRadius: '50%', background: d.color, display: 'inline-block', flexShrink: 0 }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', color: 'white', marginBottom: 3 }}>
                      <span>{d.name}</span>
                      <span style={{ color: d.color, fontWeight: 700 }}>{total > 0 ? Math.round((d.value / total) * 100) : 0}%</span>
                    </div>
                    <div style={{ height: 4, background: 'rgba(255,255,255,0.07)', borderRadius: 2, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${total > 0 ? (d.value / total) * 100 : 0}%`, background: d.color, borderRadius: 2, transition: 'width 0.6s ease' }} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <div style={{ width: 130, height: 130, flexShrink: 0 }}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={pieData} cx="50%" cy="50%" innerRadius={35} outerRadius={60} dataKey="value" stroke="none">
                    {pieData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Row */}
      <div className="chart-grid">
        {/* Top Si Leads */}
        <div className="glass-panel chart-card">
          <div className="chart-header" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <CheckCircle size={16} color="#10b981" /> Top Leads a Contactar
          </div>
          {topSi.length === 0 ? (
            <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem' }}>No hay leads con predicción "Sí" en el dataset actual.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {topSi.map((lead, i) => {
                const prob = lead.prediction?.probability || 0;
                return (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                    <div style={{ width: 28, height: 28, borderRadius: 8, background: 'rgba(16, 185, 129, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#10b981', fontWeight: 700, fontSize: '0.82rem', flexShrink: 0 }}>
                      {i + 1}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '0.85rem', color: 'white', fontWeight: 600, fontFamily: 'monospace' }}>{lead.id_user}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'capitalize' }}>{lead.profesion} · {(lead.situacion_laboral || '').replace(/_/g, ' ')}</div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                      <div style={{ width: 70, height: 5, background: 'rgba(255,255,255,0.07)', borderRadius: 3, overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${prob}%`, background: '#10b981', borderRadius: 3 }} />
                      </div>
                      <span style={{ color: '#10b981', fontWeight: 700, fontSize: '0.88rem', width: 36 }}>{prob}%</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Entidad Breakdown Bar Chart */}
        <div className="glass-panel chart-card">
          <div className="chart-header" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Target size={16} color="var(--text-muted)" /> Interés por Tipo de Entidad
          </div>
          <div style={{ height: 200 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={entidadData} layout="vertical" margin={{ top: 0, right: 10, left: 10, bottom: 0 }}>
                <XAxis type="number" axisLine={false} tickLine={false} tick={{ fill: 'var(--text-muted)', fontSize: 10 }} />
                <YAxis type="category" dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#cbd5e1', fontSize: 11 }} width={110} />
                <RechartsTooltip
                  contentStyle={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: 8 }}
                  labelStyle={{ color: 'white' }}
                  cursor={{ fill: 'rgba(255,255,255,0.03)' }}
                />
                <Bar dataKey="count" fill="#3b82f6" radius={[0, 4, 4, 0]} name="Leads" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

    </div>
  );
}
