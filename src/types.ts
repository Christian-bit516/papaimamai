export interface UserData {
  webinarAttendance: number; // 0: None, 1: 1-2 events, 2: 3+ events
  jobBoardClicks: number; // 0: None, 1: 1-5 clicks, 2: 6+ clicks
  employmentSector: 'public' | 'private' | 'unemployed';
  marketingInteractions: number; // 0: None, 1: Low, 2: High
  profession: 'high_affinity' | 'medium_affinity' | 'low_affinity'; 
  recencia_interaccion: number;
  cliente_antiguo: number; // 1 | 0
  ubicacion_region: string;
  tipo_entidad_interes: string;
  estado_postulacion_historica: string;
}

export interface PredictionResult {
  probability: number;
  score: number;
  breakdown: {
    label: string;
    impact: string;
    points: number;
  }[];
  recommendation: string;
  status: 'Sí' | 'No';
}

export interface CSVLead {
  id_user: string;
  asistencia_webinars: string;
  clicks_bolsa_trabajo: string;
  situacion_laboral: string;
  clicks_marketing: string;
  profesion: string;
  recencia_interaccion: number;
  cliente_antiguo: number;
  ubicacion_region: string;
  tipo_entidad_interes: string;
  estado_postulacion_historica: string;
}

export interface ProcessedLead extends CSVLead {
  prediction: PredictionResult;
}
