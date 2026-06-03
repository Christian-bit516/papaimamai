import { useState, useEffect } from 'react';
import Papa from 'papaparse';
import {
  Loader, ChevronLeft, ChevronRight,
  Users, TrendingUp, XCircle, Activity
} from 'lucide-react';

export function HistoricalData() {
  const [data, setData] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  useEffect(() => {
    fetch('/historico_entrenamiento.csv')
      .then(r => r.text())
      .then(csvText => {
        Papa.parse(csvText, {
          header: true,
          skipEmptyLines: true,
          complete: (results) => {
            setData(results.data as any[]);
            setIsLoading(false);
          }
        });
      })
      .catch(err => {
        console.error('Error loading historical data:', err);
        setIsLoading(false);
      });
  }, []);

  if (isLoading) {
    return (
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        justifyContent: 'center', gap: '1rem', color: 'var(--text-muted)',
        marginTop: '6rem'
      }}>
        <Loader className="animate-spin" size={48} color="var(--accent-orange)" />
        <p style={{ fontFamily: 'Inter, sans-serif' }}>Cargando datos históricos...</p>
      </div>
    );
  }

  const totalPages = Math.ceil(data.length / itemsPerPage);
  const paginatedData = data.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);
  const buyersCount = data.filter(r => r.compro_curso === '1').length;
  const conversionRate = data.length > 0 ? ((buyersCount / data.length) * 100).toFixed(1) : '0';
  const nonBuyers = data.length - buyersCount;

  const statCards = [
    {
      icon: <Users size={20} />,
      label: 'Total Registros',
      value: data.length.toLocaleString(),
      color: 'var(--accent-orange)',
      bg: 'rgba(251,146,60,0.08)',
      border: 'rgba(251,146,60,0.2)',
    },
    {
      icon: <TrendingUp size={20} />,
      label: 'Compraron el curso',
      value: `${buyersCount.toLocaleString()} (${conversionRate}%)`,
      color: '#10b981',
      bg: 'rgba(16,185,129,0.08)',
      border: 'rgba(16,185,129,0.2)',
    },
    {
      icon: <XCircle size={20} />,
      label: 'No compraron',
      value: nonBuyers.toLocaleString(),
      color: '#ef4444',
      bg: 'rgba(239,68,68,0.08)',
      border: 'rgba(239,68,68,0.2)',
    },
    {
      icon: <Activity size={20} />,
      label: 'Páginas totales',
      value: totalPages.toLocaleString(),
      color: '#a78bfa',
      bg: 'rgba(167,139,250,0.08)',
      border: 'rgba(167,139,250,0.2)',
    },
  ];

  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

      {/* Header */}
      <div style={{
        background: 'linear-gradient(135deg, rgba(251,146,60,0.12) 0%, rgba(167,139,250,0.08) 100%)',
        border: '1px solid var(--card-border)',
        borderRadius: '16px',
        padding: '1.75rem 2rem',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
          <div style={{
            width: 40, height: 40, borderRadius: '10px',
            background: 'rgba(251,146,60,0.15)', display: 'flex',
            alignItems: 'center', justifyContent: 'center',
            border: '1px solid rgba(251,146,60,0.3)'
          }}>
            <Activity size={20} color="var(--accent-orange)" />
          </div>
          <h2 style={{ fontSize: '1.4rem', fontWeight: 700, margin: 0 }}>
            Datos Históricos de Entrenamiento
          </h2>
        </div>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', margin: 0, paddingLeft: '52px' }}>
          Dataset estático con el que el modelo Random Forest aprendió a predecir. Incluye la etiqueta real <code style={{ background: 'rgba(255,255,255,0.07)', padding: '1px 6px', borderRadius: '4px' }}>compro_curso</code>.
        </p>
      </div>

      {/* Stat Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
        {statCards.map((card, i) => (
          <div key={i} style={{
            background: card.bg,
            border: `1px solid ${card.border}`,
            borderRadius: '14px',
            padding: '1.25rem 1.5rem',
            display: 'flex', flexDirection: 'column', gap: '0.5rem'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: card.color }}>
              {card.icon}
              <span style={{ fontSize: '0.8rem', fontWeight: 500, color: 'var(--text-muted)' }}>{card.label}</span>
            </div>
            <div style={{ fontSize: '1.6rem', fontWeight: 700, color: card.color }}>{card.value}</div>
          </div>
        ))}
      </div>

      {/* Table */}
      <div className="glass-panel" style={{ overflow: 'hidden', borderRadius: '16px' }}>
        {/* Table header bar */}
        <div style={{
          padding: '1rem 1.5rem',
          borderBottom: '1px solid var(--card-border)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between'
        }}>
          <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-muted)' }}>
            Mostrando registros {(currentPage - 1) * itemsPerPage + 1}–{Math.min(currentPage * itemsPerPage, data.length)} de {data.length.toLocaleString()}
          </span>
          <div style={{ display: 'flex', gap: '6px' }}>
            <button
              onClick={() => setCurrentPage(p => Math.max(p - 1, 1))}
              disabled={currentPage === 1}
              className="pagination-btn"
            >
              <ChevronLeft size={15} />
            </button>
            <span style={{
              padding: '4px 14px', borderRadius: '8px',
              background: 'rgba(255,255,255,0.05)', border: '1px solid var(--card-border)',
              fontSize: '0.82rem', fontWeight: 600, minWidth: 80, textAlign: 'center'
            }}>
              {currentPage} / {totalPages}
            </span>
            <button
              onClick={() => setCurrentPage(p => Math.min(p + 1, totalPages))}
              disabled={currentPage === totalPages}
              className="pagination-btn"
            >
              <ChevronRight size={15} />
            </button>
          </div>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table className="leads-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Profesión</th>
                <th>Sector</th>
                <th>Región</th>
                <th>Recencia</th>
                <th>Webinars</th>
                <th>Clicks Bolsa</th>
                <th>Marketing</th>
                <th>Antiguo</th>
                <th>Entidad</th>
                <th>Postulación</th>
                <th>¿Compró?</th>
              </tr>
            </thead>
            <tbody>
              {paginatedData.map((row, idx) => {
                const compro = row.compro_curso === '1';
                return (
                  <tr key={idx} className="table-row-hover">
                    <td><span className="lead-id">{row.id_user}</span></td>
                    <td style={{ fontWeight: 500 }}>{row.profesion}</td>
                    <td><span className="tag">{String(row.situacion_laboral).replace(/_/g, ' ')}</span></td>
                    <td>{row.ubicacion_region}</td>
                    <td><span className="tag">{row.recencia_interaccion}d</span></td>
                    <td style={{ textAlign: 'center' }}><span className="tag">{row.asistencia_webinars}</span></td>
                    <td style={{ textAlign: 'center' }}><span className="tag">{row.clicks_bolsa_trabajo}</span></td>
                    <td><span className="tag">{row.clicks_marketing}</span></td>
                    <td style={{ textAlign: 'center' }}>
                      <span className="tag">{row.cliente_antiguo === '1' ? 'Sí' : 'No'}</span>
                    </td>
                    <td style={{ fontSize: '0.8rem' }}>{row.tipo_entidad_interes}</td>
                    <td style={{ fontSize: '0.8rem' }}>{row.estado_postulacion_historica}</td>
                    <td>
                      <span className="status-badge" style={{
                        background: compro ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)',
                        color: compro ? '#10b981' : '#ef4444',
                        fontWeight: 700
                      }}>
                        {compro ? 'Sí' : 'No'}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Bottom pagination */}
        <div style={{
          padding: '1rem 1.5rem',
          borderTop: '1px solid var(--card-border)',
          display: 'flex', justifyContent: 'center', gap: '6px'
        }}>
          <button onClick={() => setCurrentPage(1)} disabled={currentPage === 1} className="pagination-btn" title="Primera página">«</button>
          <button onClick={() => setCurrentPage(p => Math.max(p - 1, 1))} disabled={currentPage === 1} className="pagination-btn"><ChevronLeft size={15} /></button>
          <span style={{
            padding: '6px 18px', borderRadius: '8px',
            background: 'rgba(251,146,60,0.12)', border: '1px solid rgba(251,146,60,0.3)',
            fontSize: '0.85rem', fontWeight: 600, color: 'var(--accent-orange)'
          }}>
            Página {currentPage} de {totalPages}
          </span>
          <button onClick={() => setCurrentPage(p => Math.min(p + 1, totalPages))} disabled={currentPage === totalPages} className="pagination-btn"><ChevronRight size={15} /></button>
          <button onClick={() => setCurrentPage(totalPages)} disabled={currentPage === totalPages} className="pagination-btn" title="Última página">»</button>
        </div>
      </div>
    </div>
  );
}
