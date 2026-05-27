import React, { useState, useRef } from 'react';
import Papa from 'papaparse';
import { UploadCloud, FileText, Download, FilePlus2, Search, CheckCircle, XCircle, X, ChevronUp, ChevronDown } from 'lucide-react';
import type { CSVLead, ProcessedLead } from '../types';
import { calculatePurchaseProbability } from '../utils/predict';
import { doc, setDoc } from 'firebase/firestore';
import { db } from '../firebase';

interface MassivePredictionProps {
  data: ProcessedLead[];
  setData: React.Dispatch<React.SetStateAction<ProcessedLead[]>>;
}

type SortKey = 'id_user' | 'profesion' | 'situacion_laboral' | 'probability';
type SortDir = 'asc' | 'desc';

export function MassivePrediction({ data, setData }: MassivePredictionProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [filterStatus, setFilterStatus] = useState<'Todos' | 'Sí' | 'No'>('Todos');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('id_user');
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const [isLoading, setIsLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const addFileInputRef = useRef<HTMLInputElement>(null);

  const processFile = async (file: File, isAddition = false) => {
    setIsLoading(true);
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        const parsedData = results.data as CSVLead[];
        const predictions = await calculatePurchaseProbability(parsedData);
        const processed: ProcessedLead[] = parsedData.map((lead, idx) => ({
          ...lead,
          prediction: predictions[idx]
        }));

        // Save to Firebase
        try {
          const promises = processed.map(lead => {
            if (!lead.id_user) return Promise.resolve();
            return setDoc(doc(db, 'leads', lead.id_user), lead);
          });
          await Promise.all(promises);
        } catch (e) {
          console.error("Error saving to Firebase:", e);
        }

        setData((prev) => {
          if (!isAddition) return processed;
          const newMap = new Map();
          prev.forEach(p => newMap.set(p.id_user, p));
          processed.forEach(p => newMap.set(p.id_user, p));
          return Array.from(newMap.values());
        });
        setIsLoading(false);
      }
    });
  };

  const onDragOver = (e: React.DragEvent) => { e.preventDefault(); setIsDragging(true); };
  const onDragLeave = () => setIsDragging(false);
  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files?.length) processFile(e.dataTransfer.files[0]);
  };

  // Sorting handler
  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('asc'); }
  };

  // Filter + Search + Sort
  const filteredData = data
    .filter(lead => filterStatus === 'Todos' || lead.prediction?.status === filterStatus)
    .filter(lead => {
      if (!searchQuery) return true;
      const q = searchQuery.toLowerCase();
      return (
        lead.id_user?.toLowerCase().includes(q) ||
        lead.profesion?.toLowerCase().includes(q) ||
        lead.situacion_laboral?.toLowerCase().includes(q)
      );
    })
    .sort((a, b) => {
      let aVal: string | number = '';
      let bVal: string | number = '';
      
      if (sortKey === 'probability') {
        aVal = a.prediction?.probability || 0;
        bVal = b.prediction?.probability || 0;
      } else if (sortKey === 'id_user') {
        aVal = a.id_user || '';
        bVal = b.id_user || '';
        
        const aNumMatch = String(aVal).match(/\d+/);
        const bNumMatch = String(bVal).match(/\d+/);
        
        if (aNumMatch && bNumMatch) {
          const aNum = parseInt(aNumMatch[0], 10);
          const bNum = parseInt(bNumMatch[0], 10);
          if (aNum !== bNum) {
            return sortDir === 'asc' ? aNum - bNum : bNum - aNum;
          }
        }
      } else if (sortKey === 'profesion') {
        aVal = a.profesion || '';
        bVal = b.profesion || '';
      } else if (sortKey === 'situacion_laboral') {
        aVal = a.situacion_laboral || '';
        bVal = b.situacion_laboral || '';
      }
      
      if (aVal < bVal) return sortDir === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });

  const downloadCSV = () => {
    const csvData = filteredData.map(l => ({
      id_user: l.id_user,
      asistencia_webinars: l.asistencia_webinars,
      clicks_bolsa_trabajo: l.clicks_bolsa_trabajo,
      situacion_laboral: l.situacion_laboral,
      clicks_marketing: l.clicks_marketing,
      profesion: l.profesion,
      recencia_interaccion: l.recencia_interaccion,
      cliente_antiguo: l.cliente_antiguo,
      ubicacion_region: l.ubicacion_region,
      tipo_entidad_interes: l.tipo_entidad_interes,
      estado_postulacion_historica: l.estado_postulacion_historica,
      probabilidad_compra: (l.prediction?.probability || 0) + '%',
      estado: l.prediction?.status || 'No',
      recomendacion: l.prediction?.recommendation || ''
    }));
    const csv = Papa.unparse(csvData);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    const filterLabel = filterStatus === 'Todos' ? 'todos' : filterStatus.toLowerCase();
    link.setAttribute('download', `leads_${filterLabel}_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const SortIcon = ({ col }: { col: SortKey }) => {
    if (sortKey !== col) return <ChevronUp size={12} style={{ opacity: 0.3 }} />;
    return sortDir === 'asc' ? <ChevronUp size={12} /> : <ChevronDown size={12} />;
  };

  const siCount = data.filter(d => d.prediction?.status === 'Sí').length;
  const noCount = data.filter(d => d.prediction?.status === 'No').length;

  if (!data.length) {
    return (
      <div className="animate-fade-in">
        <div
          className={`dropzone-area ${isDragging ? 'dragging' : ''}`}
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          onDrop={onDrop}
          onClick={() => fileInputRef.current?.click()}
        >
          <input type="file" accept=".csv" ref={fileInputRef} style={{ display: 'none' }}
            onChange={e => e.target.files && processFile(e.target.files[0])}
          />
          <div className="dropzone-icon">
            <UploadCloud size={48} />
          </div>
          {isLoading ? (
            <>
              <h3>Procesando con la IA…</h3>
              <div className="loading-bar"><div className="loading-bar-inner" /></div>
            </>
          ) : (
            <>
              <h3>Arrastra tu dataset de leads</h3>
              <p>Suelta un archivo CSV aquí o haz clic para buscarlo</p>
              <div className="csv-columns-hint" style={{display:'flex', flexWrap:'wrap', justifyContent:'center'}}>
                <span>id_user</span><span>asistencia_webinars</span><span>clicks_bolsa_trabajo</span>
                <span>situacion_laboral</span><span>clicks_marketing</span><span>profesion</span>
                <span>recencia_interaccion</span><span>cliente_antiguo</span><span>ubicacion_region</span>
                <span>tipo_entidad_interes</span><span>estado_postulacion_historica</span>
              </div>
            </>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="animate-fade-in">

      {/* Summary Stats Bar */}
      <div className="stats-bar">
        <div className="stat-pill total">
          <FileText size={16} />
          <span>{data.length} leads totales</span>
        </div>
        <div className="stat-pill hot" onClick={() => setFilterStatus(filterStatus === 'Sí' ? 'Todos' : 'Sí')} style={{background: filterStatus === 'Sí' ? 'rgba(16, 185, 129, 0.2)' : ''}}>
          <CheckCircle size={16} color="#10b981" />
          <span style={{color: '#10b981'}}>{siCount} Sí</span>
        </div>
        <div className="stat-pill cold" onClick={() => setFilterStatus(filterStatus === 'No' ? 'Todos' : 'No')} style={{background: filterStatus === 'No' ? 'rgba(239, 68, 68, 0.2)' : ''}}>
          <XCircle size={16} color="#ef4444" />
          <span style={{color: '#ef4444'}}>{noCount} No</span>
        </div>
        <span style={{ flex: 1 }} />
        {/* Action buttons */}
        <input type="file" accept=".csv" ref={addFileInputRef} style={{ display: 'none' }}
          onChange={e => e.target.files && processFile(e.target.files[0], true)}
        />
        <button className="btn-action btn-add" onClick={() => addFileInputRef.current?.click()}>
          <FilePlus2 size={15} /> Añadir más datos
        </button>
        <button className="btn-action btn-download" onClick={downloadCSV}>
          <Download size={15} /> Descargar CSV
        </button>
      </div>

      {/* Filters & Search */}
      <div className="filters-bar">
        <div className="search-wrapper">
          <Search size={15} />
          <input
            className="search-input"
            placeholder="Buscar por ID, profesión, sector…"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
          />
          {searchQuery && (
            <button style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 0 }}
              onClick={() => setSearchQuery('')}><X size={14} /></button>
          )}
        </div>

        <div className="filter-tabs">
          {(['Todos', 'Sí', 'No'] as const).map(status => (
            <button
              key={status}
              className={`filter-tab ${filterStatus === status ? 'active' : ''}`}
              style={filterStatus === status ? {background: 'rgba(255,255,255,0.1)', color: 'white'} : {}}
              onClick={() => setFilterStatus(status)}
            >
              {status}
            </button>
          ))}
        </div>

        <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginLeft: 'auto' }}>
          {filteredData.length} resultado{filteredData.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Table */}
      <div className="glass-panel" style={{ overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table className="leads-table">
            <thead>
              <tr>
                <th onClick={() => handleSort('id_user')} className="sortable">ID Usuario <SortIcon col="id_user" /></th>
                <th onClick={() => handleSort('profesion')} className="sortable">Profesión <SortIcon col="profesion" /></th>
                <th onClick={() => handleSort('situacion_laboral')} className="sortable">Sector <SortIcon col="situacion_laboral" /></th>
                <th>Región</th>
                <th>Recencia</th>
                <th>Asistencia</th>
                <th>Bolsa Trabajo</th>
                <th>Marketing</th>
                <th>Cliente Ant.</th>
                <th>Entidad Int.</th>
                <th>Hist. Postulación</th>
                <th onClick={() => handleSort('probability')} className="sortable">Probabilidad <SortIcon col="probability" /></th>
                <th>Estado</th>
              </tr>
            </thead>
            <tbody>
              {filteredData.map((lead, idx) => {
                const prob = lead.prediction?.probability || 0;
                const status = lead.prediction?.status || 'No';
                return (
                  <tr key={idx} className="table-row">
                    <td><span className="id-badge">{lead.id_user}</span></td>
                    <td style={{ textTransform: 'capitalize' }}>{lead.profesion || '—'}</td>
                    <td style={{ textTransform: 'capitalize' }}>{(lead.situacion_laboral || '—').replace(/_/g, ' ')}</td>
                    <td>
                      <span className="tag">{lead.ubicacion_region || '—'}</span>
                    </td>
                    <td>
                      <span className="tag">{lead.recencia_interaccion !== undefined ? `${lead.recencia_interaccion}d` : '—'}</span>
                    </td>
                    <td><span className="tag">{(lead.asistencia_webinars || '—').replace(/_/g, ' ')}</span></td>
                    <td><span className="tag">{lead.clicks_bolsa_trabajo || '—'}</span></td>
                    <td><span className="tag">{lead.clicks_marketing || '—'}</span></td>
                    <td><span className="tag">{lead.cliente_antiguo == 1 ? 'Sí' : 'No'}</span></td>
                    <td><span className="tag">{lead.tipo_entidad_interes || '—'}</span></td>
                    <td><span className="tag">{lead.estado_postulacion_historica || '—'}</span></td>
                    <td>
                      <div className="prob-cell">
                        <div className="prob-bar-bg">
                          <div
                            className="prob-bar-fill"
                            style={{
                              width: prob + '%',
                              background: status === 'Sí' ? '#10b981' : '#ef4444'
                            }}
                          />
                        </div>
                        <span className="prob-label">{prob}%</span>
                      </div>
                    </td>
                    <td>
                      <span className="status-badge" style={{
                          background: status === 'Sí' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                          color: status === 'Sí' ? '#10b981' : '#ef4444'
                      }}>
                        {status === 'Sí' && <CheckCircle size={11} />}
                        {status === 'No' && <XCircle size={11} />}
                        {status}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {filteredData.length === 0 && (
            <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
              No hay resultados para los filtros aplicados.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
