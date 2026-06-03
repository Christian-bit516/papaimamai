from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List
import numpy as np
from sklearn.ensemble import RandomForestClassifier
from sklearn.preprocessing import OrdinalEncoder
import joblib
import warnings
warnings.filterwarnings("ignore")

app = FastAPI(title="Predicción de Ventas API - CapacitaIA")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─── Schemas ───────────────────────────────────────────────────────────────────

class LeadInput(BaseModel):
    id_user: str
    asistencia_webinars: str
    clicks_bolsa_trabajo: str
    situacion_laboral: str
    clicks_marketing: str
    profesion: str
    recencia_interaccion: int
    cliente_antiguo: int
    ubicacion_region: str
    tipo_entidad_interes: str
    estado_postulacion_historica: str

class BreakdownItem(BaseModel):
    label: str
    impact: str
    points: int

class PredictionOutput(BaseModel):
    id_user: str
    probability: int
    score: int
    breakdown: List[BreakdownItem]
    recommendation: str
    status: str

# ─── Global ML State ───────────────────────────────────────────────────────────

model = None
encoders = {}

FEATURES = [
    'asistencia_webinars',
    'clicks_bolsa_trabajo',
    'situacion_laboral',
    'clicks_marketing',
    'profesion',
    'recencia_interaccion',
    'cliente_antiguo',
    'ubicacion_region',
    'tipo_entidad_interes',
    'estado_postulacion_historica'
]

CATEGORIES = {
    'situacion_laboral':     ['sector_privado', 'independiente', 'sector_publico'],
    'clicks_marketing':      ['nula', 'media', 'alta'],
    'profesion': [
        'Profesor', 'Medico', 'Ingeniero', 'Arquitecto', 'Contador',
        'Abogado', 'Administrador', 'Economista', 'Otro'
    ],
    'ubicacion_region': ['Lima', 'Callao', 'Cusco', 'Piura', 'Arequipa', 'Otro'],
    'tipo_entidad_interes': ['Ministerios/Poder Ejecutivo', 'Gobierno Regional', 'Municipalidades', 'Organismos Autónomos', 'Otro'],
    'estado_postulacion_historica': ['Solo visualizador', 'Postulante frecuente', 'Finalista/Seleccionado', 'Otro']
}

# ─── Business-Rule Scoring ─────────────────────────────────────────────────────

def get_deterministic_score(row: dict) -> int:
    """Pure deterministic score based on validated business rules."""
    score = 0

    # 1. Webinar attendance
    asist = row.get('asistencia_webinars', '')
    if asist in ('3_o_mas', '3 o mas'):
        score += 15
    elif asist in ('1_a_2', '1 a 2'):
        score += 5

    # 2. Job board clicks
    bolsa = row.get('clicks_bolsa_trabajo', '')
    if bolsa in ('mas_de_5', 'mas de 5'):
        score += 10
    elif bolsa in ('1_a_5', '1 a 5'):
        score += 5

    # 3. Employment sector
    sector = row.get('situacion_laboral', '')
    if sector in ('sector_publico', 'sector publico'):
        score += 10

    # 4. Marketing interactions
    mkt = row.get('clicks_marketing', '')
    if mkt == 'alta':
        score += 10
    elif mkt == 'media':
        score += 5

    # 5. Professional affinity
    prof = str(row.get('profesion', '')).lower()
    if any(p in prof for p in ('abogado', 'administrador', 'economista')):
        score += 5

    # 6. Recencia interacción (días)
    try:
        recencia = int(row.get('recencia_interaccion', 999))
    except ValueError:
        recencia = 999
        
    if recencia <= 7:
        score += 15
    elif recencia <= 30:
        score += 5
        
    # 7. Cliente antiguo
    try:
        antiguo = int(row.get('cliente_antiguo', 0))
    except ValueError:
        antiguo = 0
        
    if antiguo == 1:
        score += 20
        
    # 8. Ubicación geográfica
    region = row.get('ubicacion_region', '')
    if region not in ('Lima', 'Callao'):
        score += 10
        
    # 9. Tipo de entidad de interés
    entidad = row.get('tipo_entidad_interes', '')
    if entidad in ('Municipalidades', 'Gobierno Regional'):
        score += 10
        
    # 10. Estado postulación histórica
    estado_post = row.get('estado_postulacion_historica', '')
    if estado_post == 'Postulante frecuente':
        score += 15
    elif estado_post == 'Finalista/Seleccionado':
        score += 5

    return min(score, 100)


def normalize_value(feature: str, value: str) -> str:
    """Normalize incoming values to canonical form, preserving exact case."""
    v = str(value).strip()
    v_lower = v.lower()

    aliases = {
        'situacion_laboral': {'sector publico': 'sector_publico', 'sector privado': 'sector_privado'},
        'clicks_marketing': {'baja': 'nula'},
    }
    
    if feature in aliases and v_lower in aliases[feature]:
        return aliases[feature][v_lower]
        
    if feature in CATEGORIES:
        for cat in CATEGORIES[feature]:
            if cat.lower() == v_lower:
                return cat
                
    return v


# ─── Model Training ────────────────────────────────────────────────────────────

@app.on_event("startup")
def load_model():
    global model, encoders
    print("[STARTUP] Cargando modelo preentrenado desde disco...")
    try:
        model = joblib.load('backend/model.joblib')
        encoders = joblib.load('backend/encoders.joblib')
        print("[OK] Modelo y encoders cargados exitosamente.")
    except Exception as e:
        print(f"[ERROR] No se pudo cargar el modelo: {e}")


def _ml_predict_single(row: dict) -> float:
    """Get raw ML probability (0–100) for a single lead dict."""
    import pandas as pd
    df = pd.DataFrame([row])
    X = df.copy()
    
    numeric_features = ['recencia_interaccion', 'cliente_antiguo', 'asistencia_webinars', 'clicks_bolsa_trabajo']
    categorical_features = [f for f in FEATURES if f not in numeric_features]
    
    # Categorical
    for col in categorical_features:
        val = normalize_value(col, str(row.get(col, '')))
        df_col = pd.DataFrame([[val]], columns=[col])
        X[col] = encoders[col].transform(df_col)
        
    # Numeric
    X['recencia_interaccion'] = int(row.get('recencia_interaccion', 999))
    X['cliente_antiguo'] = int(row.get('cliente_antiguo', 0))
    X['asistencia_webinars'] = int(row.get('asistencia_webinars', 0))
    X['clicks_bolsa_trabajo'] = int(row.get('clicks_bolsa_trabajo', 0))
    
    # Predecir clase directamente en lugar de probabilidad (0 o 1)
    prediction = model.predict(X[FEATURES].values)[0]
    return 100.0 if prediction == 1 else 0.0


# ─── Breakdown Generation ──────────────────────────────────────────────────────

def generate_breakdown(lead: LeadInput) -> List[BreakdownItem]:
    breakdown = []
    row = lead.dict()

    # (Original rules omitted for brevity, adding new ones directly)
    # 6. Recencia
    if lead.recencia_interaccion <= 7:
        breakdown.append(BreakdownItem(label='Recencia de Interacción', impact='Alta (Interés Reciente)', points=15))
    
    # 7. Cliente antiguo
    if lead.cliente_antiguo == 1:
        breakdown.append(BreakdownItem(label='Historial de Compras', impact='Alta (Cliente Antiguo)', points=20))
        
    # 8. Ubicación
    if lead.ubicacion_region not in ('Lima', 'Callao', 'Otro'):
        breakdown.append(BreakdownItem(label='Ubicación Geográfica', impact='Media (Provincia/Descentralización)', points=10))
        
    # 9. Tipo de entidad
    if lead.tipo_entidad_interes in ('Municipalidades', 'Gobierno Regional'):
        breakdown.append(BreakdownItem(label='Tipo de Entidad', impact='Alta (Demanda Técnica Regional)', points=10))
        
    # 10. Estado Postulación
    if lead.estado_postulacion_historica == 'Postulante frecuente':
        breakdown.append(BreakdownItem(label='Postulación Histórica', impact='Alta (Necesita Capacitación Urgente)', points=15))

    return breakdown


# ─── Prediction Endpoint ───────────────────────────────────────────────────────

@app.post("/predict", response_model=List[PredictionOutput])
def predict_leads(leads: List[LeadInput]):
    if not leads:
        return []

    results = []
    for lead in leads:
        norm_row = {
            'asistencia_webinars':  normalize_value('asistencia_webinars',  lead.asistencia_webinars),
            'clicks_bolsa_trabajo': normalize_value('clicks_bolsa_trabajo', lead.clicks_bolsa_trabajo),
            'situacion_laboral':    normalize_value('situacion_laboral',    lead.situacion_laboral),
            'clicks_marketing':     normalize_value('clicks_marketing',     lead.clicks_marketing),
            'profesion':            lead.profesion,
            'recencia_interaccion': lead.recencia_interaccion,
            'cliente_antiguo':      lead.cliente_antiguo,
            'ubicacion_region':     lead.ubicacion_region,
            'tipo_entidad_interes': lead.tipo_entidad_interes,
            'estado_postulacion_historica': lead.estado_postulacion_historica
        }

        det_score = get_deterministic_score(norm_row)
        ml_prob = _ml_predict_single(norm_row)
        final_prob = int(round(ml_prob))

        # Ahora el estado es 'Sí' o 'No' y no dependiente de ser un lead hot/warm
        if final_prob >= 50:
            status = 'Sí'
            rec = 'Alta probabilidad de conversión. Contactar inmediatamente.'
        else:
            status = 'No'
            rec = 'Baja probabilidad de conversión. Mantener en flujos de nutrición.'

        breakdown = generate_breakdown(lead)

        results.append(PredictionOutput(
            id_user=lead.id_user,
            probability=final_prob,
            score=det_score,
            breakdown=breakdown,
            recommendation=rec,
            status=status,
        ))

    return results

@app.get("/health")
def health():
    return {"status": "ok", "model_ready": model is not None}
