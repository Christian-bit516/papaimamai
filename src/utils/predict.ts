import type { UserData, PredictionResult, CSVLead } from '../types';

export async function calculatePurchaseProbability(leads: CSVLead[]): Promise<PredictionResult[]> {
  try {
    const response = await fetch('http://localhost:8000/predict', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(leads),
    });

    if (!response.ok) {
      console.error('Error from backend:', response.statusText);
      return [];
    }

    const data: PredictionResult[] = await response.json();
    return data;
  } catch (error) {
    console.error('Failed to fetch prediction from backend:', error);
    return [];
  }
}

// Convert UserData (from manual form) to CSVLead format for the API
// Values MUST match the canonical values the backend normalizer expects:
//   asistencia_webinars:  '0_eventos' | '1_a_2'        | '3_o_mas'
//   clicks_bolsa_trabajo: '0_clicks'  | '1_a_5'        | 'mas_de_5'
//   situacion_laboral:    'sector_privado' | 'independiente' | 'sector_publico'
//   clicks_marketing:     'nula'      | 'media'         | 'alta'
//   profesion:            any of the profession names
export function manualDataToCSVLead(data: UserData): CSVLead {
  const webinarMap: Record<number, string> = {
    0: '0_eventos',
    1: '1_a_2',
    2: '3_o_mas',
  };
  const bolsaMap: Record<number, string> = {
    0: '0_clicks',
    1: '1_a_5',
    2: 'mas_de_5',
  };
  const sectorMap: Record<string, string> = {
    public:     'sector_publico',
    private:    'sector_privado',
    unemployed: 'independiente',
  };
  const marketingMap: Record<number, string> = {
    0: 'nula',
    1: 'media',
    2: 'alta',
  };
  const profMap: Record<string, string> = {
    high_affinity:   'Abogado',       // Derecho / Administración / Economía
    medium_affinity: 'Ingeniero',     // Ingeniería / Ciencias Sociales
    low_affinity:    'Profesor',      // Otras profesiones
  };

  return {
    id_user:              'MANUAL_LEAD',
    asistencia_webinars:  webinarMap[data.webinarAttendance]   ?? '0_eventos',
    clicks_bolsa_trabajo: bolsaMap[data.jobBoardClicks]        ?? '0_clicks',
    situacion_laboral:    sectorMap[data.employmentSector]     ?? 'independiente',
    clicks_marketing:     marketingMap[data.marketingInteractions] ?? 'nula',
    profesion:            profMap[data.profession]             ?? 'Profesor',
  };
}
