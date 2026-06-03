import pandas as pd
import numpy as np
import joblib
from sklearn.ensemble import RandomForestClassifier
from sklearn.preprocessing import OrdinalEncoder

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
    'situacion_laboral': ['sector_privado', 'independiente', 'sector_publico'],
    'clicks_marketing': ['nula', 'media', 'alta'],
    'profesion': ['Profesor', 'Medico', 'Ingeniero', 'Arquitecto', 'Contador', 'Abogado', 'Administrador', 'Economista', 'Otro'],
    'ubicacion_region': ['Lima', 'Callao', 'Cusco', 'Piura', 'Arequipa', 'Otro'],
    'tipo_entidad_interes': ['Ministerios/Poder Ejecutivo', 'Gobierno Regional', 'Municipalidades', 'Organismos Autónomos', 'Otro'],
    'estado_postulacion_historica': ['Solo visualizador', 'Postulante frecuente', 'Finalista/Seleccionado', 'Otro']
}

print("Cargando datos históricos...")
df = pd.read_csv('historico_entrenamiento.csv')

y = df['compro_curso'].values
X = df.copy()

numeric_features = ['recencia_interaccion', 'cliente_antiguo', 'asistencia_webinars', 'clicks_bolsa_trabajo']
categorical_features = [f for f in FEATURES if f not in numeric_features]

encoders = {}
for col in categorical_features:
    enc = OrdinalEncoder(
        categories=[CATEGORIES[col]],
        handle_unknown='use_encoded_value',
        unknown_value=-1
    )
    X[col] = enc.fit_transform(X[[col]])
    encoders[col] = enc

# Train Random Forest
print("Entrenando RandomForestClassifier...")
model = RandomForestClassifier(
    n_estimators=100,
    max_depth=10,
    random_state=42
)
model.fit(X[FEATURES].values, y)

print("Guardando modelo en backend/model.joblib ...")
joblib.dump(model, 'backend/model.joblib')
joblib.dump(encoders, 'backend/encoders.joblib')

print("¡Modelo entrenado y guardado correctamente!")
