import { useState, useEffect } from 'react';
import {
  CalendarDays, Briefcase, Building, Mail, GraduationCap,
  CheckCircle, XCircle, Loader, RotateCcw, Zap, MapPin, History, Clock, Star
} from 'lucide-react';
import { calculatePurchaseProbability, manualDataToCSVLead } from '../utils/predict';
import type { UserData, PredictionResult } from '../types';

const DEFAULT_FORM: UserData = {
  webinarAttendance: 0,
  jobBoardClicks: 0,
  employmentSector: 'unemployed',
  marketingInteractions: 0,
  profession: 'low_affinity',
  recencia_interaccion: 30,
  cliente_antiguo: 0,
  ubicacion_region: 'Lima',
  tipo_entidad_interes: 'Ministerios/Poder Ejecutivo',
  estado_postulacion_historica: 'Solo visualizador'
};

const FIELDS = [
  {
    key: 'webinarAttendance' as keyof UserData,
    label: 'Asistencia a webinars',
    icon: CalendarDays,
    hint: 'Cuántos eventos gratuitos ha consumido',
    options: [
      { value: 0, label: 'Sin asistencia' },
      { value: 1, label: '1 a 2 eventos' },
      { value: 2, label: '3 o más eventos' },
    ]
  },
  {
    key: 'jobBoardClicks' as keyof UserData,
    label: 'Clics en bolsa de trabajo',
    icon: Briefcase,
    hint: 'Interacción con convocatorias laborales',
    options: [
      { value: 0, label: 'Sin interacción' },
      { value: 1, label: '1 a 5 postulaciones' },
      { value: 2, label: 'Más de 5 postulaciones' },
    ]
  },
  {
    key: 'employmentSector' as keyof UserData,
    label: 'Situación laboral',
    icon: Building,
    hint: 'Sector donde trabaja actualmente',
    options: [
      { value: 'unemployed', label: 'Independiente / Buscando empleo' },
      { value: 'private',    label: 'Sector Privado' },
      { value: 'public',     label: 'Sector Público (Estado)' },
    ]
  },
  {
    key: 'marketingInteractions' as keyof UserData,
    label: 'Interacción de marketing',
    icon: Mail,
    hint: 'Apertura de correos y clics recientes',
    options: [
      { value: 0, label: 'No abre correos' },
      { value: 1, label: 'Aperturas ocasionales' },
      { value: 2, label: 'Alta interacción reciente' },
    ]
  },
  {
    key: 'profession' as keyof UserData,
    label: 'Profesión',
    icon: GraduationCap,
    hint: 'Afinidad con cursos de Gestión Pública',
    options: [
      { value: 'low_affinity',    label: 'Otras profesiones' },
      { value: 'medium_affinity', label: 'Ingeniería / Ciencias Sociales' },
      { value: 'high_affinity',   label: 'Derecho / Administración / Economía' },
    ]
  },
  {
    key: 'recencia_interaccion' as keyof UserData,
    label: 'Días desde última interacción',
    icon: Clock,
    hint: 'Recencia (0 = muy activo, 180 = inactivo)',
    isNumber: true
  },
  {
    key: 'cliente_antiguo' as keyof UserData,
    label: '¿Es Cliente Antiguo?',
    icon: Star,
    hint: 'Si compró un curso anteriormente',
    options: [
      { value: 0, label: 'No' },
      { value: 1, label: 'Sí' }
    ]
  },
  {
    key: 'ubicacion_region' as keyof UserData,
    label: 'Región de Ubicación',
    icon: MapPin,
    hint: 'Región en Perú',
    options: [
      { value: 'Lima', label: 'Lima' },
      { value: 'Callao', label: 'Callao' },
      { value: 'Cusco', label: 'Cusco' },
      { value: 'Piura', label: 'Piura' },
      { value: 'Arequipa', label: 'Arequipa' },
      { value: 'Otro', label: 'Otra región' }
    ]
  },
  {
    key: 'tipo_entidad_interes' as keyof UserData,
    label: 'Entidad de Interés',
    icon: Building,
    hint: 'A qué entidad del Estado suele postular',
    options: [
      { value: 'Ministerios/Poder Ejecutivo', label: 'Ministerios/Poder Ejecutivo' },
      { value: 'Gobierno Regional', label: 'Gobierno Regional' },
      { value: 'Municipalidades', label: 'Municipalidades' },
      { value: 'Organismos Autónomos', label: 'Organismos Autónomos' },
      { value: 'Otro', label: 'Otra Entidad' }
    ]
  },
  {
    key: 'estado_postulacion_historica' as keyof UserData,
    label: 'Estado de Postulación',
    icon: History,
    hint: 'Su historial en convocatorias públicas',
    options: [
      { value: 'Solo visualizador', label: 'Solo visualizador' },
      { value: 'Postulante frecuente', label: 'Postulante frecuente' },
      { value: 'Finalista/Seleccionado', label: 'Finalista/Seleccionado' },
      { value: 'Otro', label: 'Otro' }
    ]
  }
];

export function ManualSimulation() {
  const [form, setForm]         = useState<UserData>(DEFAULT_FORM);
  const [result, setResult]     = useState<PredictionResult | null>(null);
  const [loading, setLoading]   = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      const preds = await calculatePurchaseProbability([manualDataToCSVLead(form)]);
      if (alive && preds?.length) setResult(preds[0]);
      if (alive) setLoading(false);
    })();
    return () => { alive = false; };
  }, [form]);

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement | HTMLInputElement>) => {
    const { name, value } = e.target;
    const isNumField = ['webinarAttendance','jobBoardClicks','marketingInteractions','cliente_antiguo','recencia_interaccion'].includes(name);
    const v = isNumField ? parseInt(value || '0', 10) : value;
    setForm(p => ({ ...p, [name]: v }));
  };

  const prob    = result?.probability ?? 0;
  const status  = result?.status ?? 'No';
  const clr     = status === 'Sí' ? '#10b981' : '#ef4444';
  const bgClr   = status === 'Sí' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)';

  /* SVG Donut gauge */
  const R = 72, SW = 12;
  const circ = 2 * Math.PI * R;
  const filled = (prob / 100) * circ;

  return (
    <div className="sim-wrapper animate-fade-in">

      {/* ──── Left Column: Form ──── */}
      <div className="sim-form-col">
        <div className="sim-form-header">
          <Zap size={18} color="var(--accent-orange)" />
          <span>Datos del Lead</span>
          <button className="sim-reset-btn" onClick={() => setForm(DEFAULT_FORM)}>
            <RotateCcw size={13} /> Reset
          </button>
        </div>

        {FIELDS.map(field => {
          const Icon = field.icon;
          return (
            <div key={field.key} className="sim-field">
              <label className="sim-label">
                <Icon size={14} color={clr} />
                {field.label}
              </label>
              <p className="sim-hint">{field.hint}</p>
              <div className="sim-select-wrap">
                {field.isNumber ? (
                  <input
                    type="number"
                    name={field.key}
                    value={(form as any)[field.key]}
                    onChange={handleChange}
                    className="sim-select"
                    style={{ padding: '8px 12px' }}
                    min="0"
                  />
                ) : (
                  <select
                    name={field.key}
                    value={(form as any)[field.key]}
                    onChange={handleChange}
                    className="sim-select"
                  >
                    {field.options?.map(o => (
                      <option key={String(o.value)} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* ──── Right Column: Result ──── */}
      <div className="sim-result-col">

        {/* Gauge card */}
        <div className="sim-gauge-card" style={{ borderTop: `3px solid ${clr}` }}>
          {loading ? (
            <div className="sim-loading">
              <Loader className="animate-spin" size={36} color="var(--accent-orange)" />
              <span>Analizando con la IA…</span>
            </div>
          ) : (
            <>
              {/* Donut */}
              <div className="sim-gauge-wrap">
                <svg width="180" height="180" viewBox="0 0 180 180">
                  {/* Track */}
                  <circle cx="90" cy="90" r={R} fill="none"
                    stroke="rgba(255,255,255,0.06)" strokeWidth={SW} />
                  {/* Progress */}
                  <circle cx="90" cy="90" r={R} fill="none"
                    stroke={clr} strokeWidth={SW}
                    strokeLinecap="round"
                    strokeDasharray={`${filled} ${circ}`}
                    strokeDashoffset={circ / 4}   /* start at top */
                    style={{ transition: 'stroke-dasharray 0.8s ease, stroke 0.4s ease' }}
                  />
                  {/* Glow ring */}
                  <circle cx="90" cy="90" r={R} fill="none"
                    stroke={clr} strokeWidth={SW + 8} opacity="0.05"
                    strokeDasharray={`${filled} ${circ}`}
                    strokeDashoffset={circ / 4}
                  />
                  {/* Center text */}
                  <text x="90" y="84" textAnchor="middle"
                    fill="white" fontSize="34" fontWeight="800" fontFamily="Inter,sans-serif">
                    {prob}%
                  </text>
                  <text x="90" y="106" textAnchor="middle"
                    fill={clr} fontSize="15" fontWeight="700" fontFamily="Inter,sans-serif">
                    {status}
                  </text>
                </svg>
              </div>

              {/* Status strip */}
              <div className="sim-status-strip" style={{ background: bgClr, borderColor: `${clr}40` }}>
                {status === 'Sí' ? <CheckCircle size={16} color={clr} /> : <XCircle size={16} color={clr} />}
                <span style={{ color: clr, fontWeight: 700 }}>Predicción: {status} Comprará</span>
                <span style={{ color: 'var(--text-muted)', fontSize: '0.78rem', marginLeft: 'auto' }}>
                  Probabilidad: {prob}%
                </span>
              </div>

              {/* Recommendation */}
              {result?.recommendation && (
                <div className="sim-rec">
                  <p className="sim-rec-title">Acción Recomendada</p>
                  <p className="sim-rec-body">{result.recommendation}</p>
                </div>
              )}
            </>
          )}
        </div>

        {/* Breakdown */}
        {result && !loading && result.breakdown?.length > 0 && (
          <div className="sim-breakdown-card">
            <p className="sim-breakdown-title">Desglose por Variable</p>
            {result.breakdown.map((item, i) => {
              const pct   = Math.min((item.points / 30) * 100, 100);
              const bclr  = item.points >= 20 ? '#10b981' : item.points >= 10 ? '#3b82f6' : '#8b95a5';
              return (
                <div key={i} className="sim-breakdown-row">
                  <div className="sim-breakdown-meta">
                    <span className="sim-breakdown-label">{item.label}</span>
                    <span className="sim-breakdown-pts" style={{ color: bclr }}>+{item.points} pts</span>
                  </div>
                  <div className="sim-bar-bg">
                    <div className="sim-bar-fill" style={{ width: `${pct}%`, background: bclr }} />
                  </div>
                  <span className="sim-breakdown-impact">Impacto: {item.impact}</span>
                </div>
              );
            })}
          </div>
        )}

      </div>
    </div>
  );
}
