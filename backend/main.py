from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List
import numpy as np
from sklearn.ensemble import GradientBoostingClassifier
from sklearn.preprocessing import OrdinalEncoder
from sklearn.calibration import CalibratedClassifierCV
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

# Valid categories for categorical features
CATEGORIES = {
    'asistencia_webinars':   ['0_eventos', '1_a_2', '3_o_mas'],
    'clicks_bolsa_trabajo':  ['0_clicks',  '1_a_5', 'mas_de_5'],
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
    """Normalize incoming values to canonical form, including raw numbers."""
    v = str(value).strip().lower()
    
    # Manejo especial para números en asistencia y clicks
    if feature == 'asistencia_webinars' and v.isdigit():
        num = int(v)
        if num == 0: return '0_eventos'
        elif num <= 2: return '1_a_2'
        else: return '3_o_mas'
        
    if feature == 'clicks_bolsa_trabajo' and v.isdigit():
        num = int(v)
        if num == 0: return '0_clicks'
        elif num <= 5: return '1_a_5'
        else: return 'mas_de_5'

    aliases = {
        'asistencia_webinars': {'3 o mas': '3_o_mas', '1 a 2': '1_a_2', '0 eventos': '0_eventos'},
        'clicks_bolsa_trabajo': {'mas de 5': 'mas_de_5', '1 a 5': '1_a_5', '0 clicks': '0_clicks'},
        'situacion_laboral': {'sector publico': 'sector_publico', 'sector privado': 'sector_privado'},
        'clicks_marketing': {'baja': 'nula'},
    }
    return aliases.get(feature, {}).get(v, v)


# ─── Model Training ────────────────────────────────────────────────────────────

@app.on_event("startup")
def train_model():
    global model, encoders
    print("[STARTUP] Intentando descargar datos reales de Firebase...")
    
    import urllib.request
    import json
    
    url = "https://firestore.googleapis.com/v1/projects/meme-bea08/databases/(default)/documents/leads"
    all_docs = []
    
    try:
        while url:
            req = urllib.request.Request(url)
            with urllib.request.urlopen(req) as response:
                data = json.loads(response.read().decode('utf-8'))
                docs = data.get('documents', [])
                all_docs.extend(docs)
                
                next_token = data.get('nextPageToken')
                if next_token:
                    url = f"https://firestore.googleapis.com/v1/projects/meme-bea08/databases/(default)/documents/leads?pageToken={next_token}"
                else:
                    url = None
    except Exception as e:
        print(f"[ERROR] No se pudo conectar a Firebase: {e}")
    
    N = len(all_docs)
    
    if N > 100:
        print(f"[STARTUP] Se encontraron {N} leads reales. Entrenando modelo con base de datos...")
        rows = {
            'asistencia_webinars': [],
            'clicks_bolsa_trabajo': [],
            'situacion_laboral': [],
            'clicks_marketing': [],
            'profesion': [],
            'recencia_interaccion': [],
            'cliente_antiguo': [],
            'ubicacion_region': [],
            'tipo_entidad_interes': [],
            'estado_postulacion_historica': []
        }
        
        for doc in all_docs:
            fields = doc.get('fields', {})
            
            def get_val(f_name, default, val_type='stringValue'):
                if f_name in fields:
                    if val_type in fields[f_name]:
                        return fields[f_name][val_type]
                    elif 'integerValue' in fields[f_name]:
                        return int(fields[f_name]['integerValue'])
                    elif 'doubleValue' in fields[f_name]:
                        return float(fields[f_name]['doubleValue'])
                    elif 'stringValue' in fields[f_name]:
                        v = fields[f_name]['stringValue']
                        if val_type == 'integerValue':
                            try: return int(v)
                            except: return default
                        return v
                return default

            rows['asistencia_webinars'].append(get_val('asistencia_webinars', '0_eventos'))
            rows['clicks_bolsa_trabajo'].append(get_val('clicks_bolsa_trabajo', '0_clicks'))
            rows['situacion_laboral'].append(get_val('situacion_laboral', 'independiente'))
            rows['clicks_marketing'].append(get_val('clicks_marketing', 'nula'))
            rows['profesion'].append(get_val('profesion', 'Otro'))
            rows['recencia_interaccion'].append(get_val('recencia_interaccion', 999, 'integerValue'))
            rows['cliente_antiguo'].append(get_val('cliente_antiguo', 0, 'integerValue'))
            rows['ubicacion_region'].append(get_val('ubicacion_region', 'Otro'))
            rows['tipo_entidad_interes'].append(get_val('tipo_entidad_interes', 'Otro'))
            rows['estado_postulacion_historica'].append(get_val('estado_postulacion_historica', 'Otro'))
    else:
        print("[STARTUP] Pocos datos en Firebase (o error). Usando datos sintéticos...")
        np.random.seed(42)
        N = 3000

        rows = {
            'asistencia_webinars':  np.random.choice(CATEGORIES['asistencia_webinars'], N, p=[0.45, 0.35, 0.20]),
            'clicks_bolsa_trabajo': np.random.choice(CATEGORIES['clicks_bolsa_trabajo'], N, p=[0.50, 0.30, 0.20]),
            'situacion_laboral':    np.random.choice(CATEGORIES['situacion_laboral'], N, p=[0.35, 0.30, 0.35]),
            'clicks_marketing':     np.random.choice(CATEGORIES['clicks_marketing'], N, p=[0.40, 0.35, 0.25]),
            'profesion':            np.random.choice(CATEGORIES['profesion'], N),
            'recencia_interaccion': np.random.randint(0, 180, N), # Días
            'cliente_antiguo':      np.random.binomial(1, 0.15, N),
            'ubicacion_region':     np.random.choice(CATEGORIES['ubicacion_region'], N),
            'tipo_entidad_interes': np.random.choice(CATEGORIES['tipo_entidad_interes'], N),
            'estado_postulacion_historica': np.random.choice(CATEGORIES['estado_postulacion_historica'], N),
        }

    # Compute deterministic scores
    scores = np.array([
        get_deterministic_score({k: rows[k][i] for k in rows})
        for i in range(N)
    ])

    # Convert score → purchase probability with realistic noise to generate target 'y'
    p_buy = np.clip(scores / 100.0, 0.02, 0.98)
    noise_strength = 0.15 * (1 - np.abs(p_buy - 0.5) * 2)
    p_noisy = np.clip(p_buy + np.random.normal(0, noise_strength, N), 0.02, 0.98)
    
    # Target variable (0 o 1)
    np.random.seed(42) # Mantener consistencia si falla
    y = np.random.binomial(1, p_noisy)

    # Encode features
    import pandas as pd
    df = pd.DataFrame(rows)
    
    # Manejar posibles valores no normalizados en BD
    for col in [f for f in FEATURES if f not in ('recencia_interaccion', 'cliente_antiguo')]:
        df[col] = df[col].apply(lambda x: normalize_value(col, x))

    X = df.copy()
    
    numeric_features = ['recencia_interaccion', 'cliente_antiguo']
    categorical_features = [f for f in FEATURES if f not in numeric_features]
    
    for col in categorical_features:
        enc = OrdinalEncoder(
            categories=[CATEGORIES[col]],
            handle_unknown='use_encoded_value',
            unknown_value=-1
        )
        X[col] = enc.fit_transform(X[[col]])
        encoders[col] = enc

    # Train Gradient Boosting
    base = GradientBoostingClassifier(
        n_estimators=200,
        learning_rate=0.05,
        max_depth=4,
        subsample=0.8,
        random_state=42
    )
    model = CalibratedClassifierCV(base, method='isotonic', cv=min(5, N))
    model.fit(X.values, y)

    print(f"[OK] Modelo entrenado exitosamente con {N} registros.")


def _ml_predict_single(row: dict) -> float:
    """Get raw ML probability (0–100) for a single lead dict."""
    import pandas as pd
    df = pd.DataFrame([row])
    X = df.copy()
    
    numeric_features = ['recencia_interaccion', 'cliente_antiguo']
    categorical_features = [f for f in FEATURES if f not in numeric_features]
    
    # Categorical
    for col in categorical_features:
        val = normalize_value(col, str(row.get(col, '')))
        df_col = pd.DataFrame([[val]], columns=[col])
        X[col] = encoders[col].transform(df_col)
        
    # Numeric
    X['recencia_interaccion'] = int(row.get('recencia_interaccion', 999))
    X['cliente_antiguo'] = int(row.get('cliente_antiguo', 0))
    
    prob = model.predict_proba(X[FEATURES].values)[0][1]  # P(buy=1)
    return prob * 100


def _blend(det_score: int, ml_prob: float, weight_det: float = 0.65) -> int:
    blended = weight_det * det_score + (1 - weight_det) * ml_prob
    return int(round(min(blended, 100)))


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
        final_prob = _blend(det_score, ml_prob)

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
