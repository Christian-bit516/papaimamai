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
    'profesion'
]

# Valid categories for each feature (used for OrdinalEncoder)
CATEGORIES = {
    'asistencia_webinars':   ['0_eventos', '1_a_2', '3_o_mas'],
    'clicks_bolsa_trabajo':  ['0_clicks',  '1_a_5', 'mas_de_5'],
    'situacion_laboral':     ['sector_privado', 'independiente', 'sector_publico'],
    'clicks_marketing':      ['nula', 'media', 'alta'],
    'profesion': [
        'Profesor', 'Medico', 'Ingeniero', 'Arquitecto', 'Contador',
        'Abogado', 'Administrador', 'Economista', 'Otro'
    ],
}

# ─── Business-Rule Scoring ─────────────────────────────────────────────────────
# Max points possible: 30 + 25 + 20 + 15 + 10 = 100

def get_deterministic_score(row: dict) -> int:
    """Pure deterministic score based on validated business rules."""
    score = 0

    # 1. Webinar attendance (max 30 pts)
    asist = row.get('asistencia_webinars', '')
    if asist in ('3_o_mas', '3 o mas'):
        score += 30
    elif asist in ('1_a_2', '1 a 2'):
        score += 15

    # 2. Job board clicks (max 25 pts)
    bolsa = row.get('clicks_bolsa_trabajo', '')
    if bolsa in ('mas_de_5', 'mas de 5'):
        score += 25
    elif bolsa in ('1_a_5', '1 a 5'):
        score += 10

    # 3. Employment sector (max 20 pts)
    sector = row.get('situacion_laboral', '')
    if sector in ('sector_publico', 'sector publico'):
        score += 20
    elif sector in ('sector_privado', 'sector privado'):
        score += 5
    else:
        score += 10  # independiente / buscando

    # 4. Marketing interactions (max 15 pts)
    mkt = row.get('clicks_marketing', '')
    if mkt == 'alta':
        score += 15
    elif mkt == 'media':
        score += 5

    # 5. Professional affinity (max 10 pts)
    prof = str(row.get('profesion', '')).lower()
    if any(p in prof for p in ('abogado', 'administrador', 'economista')):
        score += 10
    elif any(p in prof for p in ('ingeniero', 'arquitecto', 'contador')):
        score += 5

    return min(score, 100)


def normalize_value(feature: str, value: str) -> str:
    """Normalize incoming values to canonical form."""
    v = str(value).strip()
    aliases = {
        'asistencia_webinars': {'3 o mas': '3_o_mas', '1 a 2': '1_a_2', '0 eventos': '0_eventos'},
        'clicks_bolsa_trabajo': {'mas de 5': 'mas_de_5', '1 a 5': '1_a_5', '0 clicks': '0_clicks'},
        'situacion_laboral': {'sector publico': 'sector_publico', 'sector privado': 'sector_privado'},
        'clicks_marketing': {'baja': 'nula'},  # fix invalid value
    }
    return aliases.get(feature, {}).get(v, v)


# ─── Model Training ────────────────────────────────────────────────────────────

@app.on_event("startup")
def train_model():
    global model, encoders
    print("[STARTUP] Entrenando Gradient Boosting con dataset sintetico enriquecido...")
    np.random.seed(42)
    N = 3000

    # Generate balanced synthetic dataset covering all combinations
    asist_vals  = ['0_eventos', '1_a_2', '3_o_mas']
    bolsa_vals  = ['0_clicks', '1_a_5', 'mas_de_5']
    sector_vals = ['sector_privado', 'independiente', 'sector_publico']
    mkt_vals    = ['nula', 'media', 'alta']
    prof_vals   = ['Profesor', 'Medico', 'Ingeniero', 'Arquitecto', 'Contador',
                   'Abogado', 'Administrador', 'Economista', 'Otro']

    # Weighted probabilities to reflect realistic lead distribution
    rows = {
        'asistencia_webinars':  np.random.choice(asist_vals, N, p=[0.45, 0.35, 0.20]),
        'clicks_bolsa_trabajo': np.random.choice(bolsa_vals, N, p=[0.50, 0.30, 0.20]),
        'situacion_laboral':    np.random.choice(sector_vals, N, p=[0.35, 0.30, 0.35]),
        'clicks_marketing':     np.random.choice(mkt_vals, N, p=[0.40, 0.35, 0.25]),
        'profesion':            np.random.choice(prof_vals, N),
    }

    # Compute deterministic scores for each synthetic lead
    scores = np.array([
        get_deterministic_score({k: rows[k][i] for k in rows})
        for i in range(N)
    ])

    # Convert score → purchase probability with realistic noise
    # sigmoid-like transformation: high scores more likely to buy
    p_buy = np.clip(scores / 100.0, 0.02, 0.98)
    # Add calibrated noise (less noise for extreme scores)
    noise_strength = 0.15 * (1 - np.abs(p_buy - 0.5) * 2)
    p_noisy = np.clip(p_buy + np.random.normal(0, noise_strength, N), 0.02, 0.98)
    y = np.random.binomial(1, p_noisy)

    # Encode features
    import pandas as pd
    df = pd.DataFrame(rows)
    X = df.copy()
    for col in FEATURES:
        enc = OrdinalEncoder(
            categories=[CATEGORIES[col]],
            handle_unknown='use_encoded_value',
            unknown_value=-1
        )
        X[col] = enc.fit_transform(X[[col]])
        encoders[col] = enc

    # Train Gradient Boosting (better calibrated probabilities than RF)
    base = GradientBoostingClassifier(
        n_estimators=200,
        learning_rate=0.05,
        max_depth=4,
        subsample=0.8,
        random_state=42
    )
    # Isotonic calibration for better probability estimates
    model = CalibratedClassifierCV(base, method='isotonic', cv=5)
    model.fit(X.values, y)

    print("[OK] Modelo entrenado exitosamente.")
    # Quick sanity check
    test_cases = [
        # Expected ~90: 3_o_mas + mas_de_5 + independiente + alta + Abogado
        {'asistencia_webinars': '3_o_mas', 'clicks_bolsa_trabajo': 'mas_de_5',
         'situacion_laboral': 'independiente', 'clicks_marketing': 'alta', 'profesion': 'Abogado'},
        # Expected ~10: cold lead
        {'asistencia_webinars': '0_eventos', 'clicks_bolsa_trabajo': '0_clicks',
         'situacion_laboral': 'sector_privado', 'clicks_marketing': 'nula', 'profesion': 'Profesor'},
    ]
    for tc in test_cases:
        det = get_deterministic_score(tc)
        ml  = _ml_predict_single(tc)
        print(f"  Det={det} | ML={ml:.1f} | Final={_blend(det, ml)}")


def _ml_predict_single(row: dict) -> float:
    """Get raw ML probability (0–100) for a single lead dict."""
    import pandas as pd
    df = pd.DataFrame([row])
    X = df.copy()
    for col in FEATURES:
        val = normalize_value(col, str(row.get(col, '')))
        df_col = pd.DataFrame([[val]], columns=[col])
        X[col] = encoders[col].transform(df_col)
    prob = model.predict_proba(X.values)[0][1]  # P(buy=1)
    return prob * 100


def _blend(det_score: int, ml_prob: float, weight_det: float = 0.65) -> int:
    """
    Blend deterministic business score with ML probability.
    We weight the deterministic score more heavily (65%) since it encodes
    validated business knowledge, while ML adds generalization (35%).
    """
    blended = weight_det * det_score + (1 - weight_det) * ml_prob
    return int(round(min(blended, 100)))


# ─── Breakdown Generation ──────────────────────────────────────────────────────

def generate_breakdown(lead: LeadInput) -> List[BreakdownItem]:
    breakdown = []
    row = lead.dict()

    # 1. Webinar attendance
    asist = normalize_value('asistencia_webinars', row['asistencia_webinars'])
    if asist == '3_o_mas':
        breakdown.append(BreakdownItem(label='Asistencia a Eventos', impact='Alta (3+ eventos)', points=30))
    elif asist == '1_a_2':
        breakdown.append(BreakdownItem(label='Asistencia a Eventos', impact='Media (1-2 eventos)', points=15))
    else:
        breakdown.append(BreakdownItem(label='Asistencia a Eventos', impact='Nula (sin eventos)', points=0))

    # 2. Job board clicks
    bolsa = normalize_value('clicks_bolsa_trabajo', row['clicks_bolsa_trabajo'])
    if bolsa == 'mas_de_5':
        breakdown.append(BreakdownItem(label='Interacción Bolsa de Trabajo', impact='Alta — urgencia laboral', points=25))
    elif bolsa == '1_a_5':
        breakdown.append(BreakdownItem(label='Interacción Bolsa de Trabajo', impact='Media (1-5 clicks)', points=10))
    else:
        breakdown.append(BreakdownItem(label='Interacción Bolsa de Trabajo', impact='Nula (sin clicks)', points=0))

    # 3. Employment sector
    sector = normalize_value('situacion_laboral', row['situacion_laboral'])
    if sector == 'sector_publico':
        breakdown.append(BreakdownItem(label='Sector Laboral', impact='Alta — obligación institucional', points=20))
    elif sector == 'sector_privado':
        breakdown.append(BreakdownItem(label='Sector Laboral', impact='Baja (sector privado)', points=5))
    else:
        breakdown.append(BreakdownItem(label='Sector Laboral', impact='Media (independiente)', points=10))

    # 4. Marketing interactions
    mkt = normalize_value('clicks_marketing', row['clicks_marketing'])
    if mkt == 'alta':
        breakdown.append(BreakdownItem(label='Interacción Marketing', impact='Alta — alto interés', points=15))
    elif mkt == 'media':
        breakdown.append(BreakdownItem(label='Interacción Marketing', impact='Media — interés moderado', points=5))
    else:
        breakdown.append(BreakdownItem(label='Interacción Marketing', impact='Nula — sin interacción', points=0))

    # 5. Professional affinity
    prof = str(row.get('profesion', '')).lower()
    if any(p in prof for p in ('abogado', 'administrador', 'economista')):
        breakdown.append(BreakdownItem(label='Afinidad Profesional', impact='Alta — perfil ideal GP', points=10))
    elif any(p in prof for p in ('ingeniero', 'arquitecto', 'contador')):
        breakdown.append(BreakdownItem(label='Afinidad Profesional', impact='Media — perfil compatible', points=5))
    else:
        breakdown.append(BreakdownItem(label='Afinidad Profesional', impact='Baja — perfil no prioritario', points=0))

    return breakdown


# ─── Prediction Endpoint ───────────────────────────────────────────────────────

@app.post("/predict", response_model=List[PredictionOutput])
def predict_leads(leads: List[LeadInput]):
    if not leads:
        return []

    results = []
    for lead in leads:
        # Normalize input values
        norm_row = {
            'asistencia_webinars':  normalize_value('asistencia_webinars',  lead.asistencia_webinars),
            'clicks_bolsa_trabajo': normalize_value('clicks_bolsa_trabajo', lead.clicks_bolsa_trabajo),
            'situacion_laboral':    normalize_value('situacion_laboral',    lead.situacion_laboral),
            'clicks_marketing':     normalize_value('clicks_marketing',     lead.clicks_marketing),
            'profesion':            lead.profesion,
        }

        # 1. Deterministic business-rule score
        det_score = get_deterministic_score(norm_row)

        # 2. ML model probability
        ml_prob = _ml_predict_single(norm_row)

        # 3. Blended final probability
        final_prob = _blend(det_score, ml_prob)

        # 4. Status thresholds (aligned with business rules)
        if final_prob >= 70:
            status = 'Hot'
            rec = ('Lead "Hot" - Perfil de alto valor. '
                   'Contactar en las proximas 24h con una oferta directa y descuento por tiempo limitado.')
        elif final_prob >= 40:
            status = 'Warm'
            rec = ('Lead "Warm" - Interes demostrado. '
                   'Nutrir con masterclasses, casos de exito y contenido sobre Gestion Publica.')
        else:
            status = 'Cold'
            rec = ('Lead "Cold" - Perfil en etapa temprana. '
                   'Mantener en flujos de educacion y email marketing. No intentar venta directa aun.')

        breakdown = generate_breakdown(lead)

        results.append(PredictionOutput(
            id_user=lead.id_user,
            probability=final_prob,
            score=det_score,        # deterministic score for transparency
            breakdown=breakdown,
            recommendation=rec,
            status=status,
        ))

    return results


# ─── Health & Debug Endpoints ──────────────────────────────────────────────────

@app.get("/health")
def health():
    return {"status": "ok", "model_ready": model is not None}

@app.get("/score-table")
def score_table():
    """Returns the expected scores for the sample CSV leads (for debugging)."""
    sample = [
        {"id": "USR001", "asistencia_webinars": "3_o_mas",  "clicks_bolsa_trabajo": "mas_de_5", "situacion_laboral": "independiente",  "clicks_marketing": "alta",  "profesion": "Abogado"},
        {"id": "USR002", "asistencia_webinars": "1_a_2",    "clicks_bolsa_trabajo": "0_clicks",  "situacion_laboral": "sector_privado", "clicks_marketing": "nula",  "profesion": "Ingeniero"},
        {"id": "USR003", "asistencia_webinars": "0_eventos", "clicks_bolsa_trabajo": "1_a_5",    "situacion_laboral": "sector_publico", "clicks_marketing": "media", "profesion": "Administrador"},
        {"id": "USR004", "asistencia_webinars": "3_o_mas",  "clicks_bolsa_trabajo": "mas_de_5", "situacion_laboral": "sector_publico", "clicks_marketing": "alta",  "profesion": "Economista"},
        {"id": "USR005", "asistencia_webinars": "0_eventos", "clicks_bolsa_trabajo": "0_clicks", "situacion_laboral": "sector_privado", "clicks_marketing": "nula",  "profesion": "Arquitecto"},
        {"id": "USR006", "asistencia_webinars": "1_a_2",    "clicks_bolsa_trabajo": "1_a_5",    "situacion_laboral": "independiente",  "clicks_marketing": "media", "profesion": "Contador"},
        {"id": "USR007", "asistencia_webinars": "3_o_mas",  "clicks_bolsa_trabajo": "1_a_5",    "situacion_laboral": "sector_publico", "clicks_marketing": "alta",  "profesion": "Abogado"},
        {"id": "USR008", "asistencia_webinars": "1_a_2",    "clicks_bolsa_trabajo": "mas_de_5", "situacion_laboral": "sector_publico", "clicks_marketing": "media", "profesion": "Administrador"},
        {"id": "USR009", "asistencia_webinars": "0_eventos", "clicks_bolsa_trabajo": "0_clicks", "situacion_laboral": "independiente",  "clicks_marketing": "nula",  "profesion": "Profesor"},
        {"id": "USR010", "asistencia_webinars": "3_o_mas",  "clicks_bolsa_trabajo": "0_clicks", "situacion_laboral": "sector_privado", "clicks_marketing": "alta",  "profesion": "Economista"},
    ]
    return [{"id": r["id"], "det_score": get_deterministic_score(r)} for r in sample]
