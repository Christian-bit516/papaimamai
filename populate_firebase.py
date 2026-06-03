import urllib.request
import json
import random

project_id = "proyecto-prediccion-d8e98"
url = f"https://firestore.googleapis.com/v1/projects/{project_id}/databases/(default)/documents:commit"

CATEGORIES = {
    'situacion_laboral': ['sector_privado', 'independiente', 'sector_publico'],
    'clicks_marketing': ['nula', 'media', 'alta'],
    'profesion': ['Profesor', 'Medico', 'Ingeniero', 'Arquitecto', 'Contador', 'Abogado', 'Administrador', 'Economista', 'Otro'],
    'ubicacion_region': ['Lima', 'Callao', 'Cusco', 'Piura', 'Arequipa', 'Otro'],
    'tipo_entidad_interes': ['Ministerios/Poder Ejecutivo', 'Gobierno Regional', 'Municipalidades', 'Organismos Autónomos', 'Otro'],
    'estado_postulacion_historica': ['Solo visualizador', 'Postulante frecuente', 'Finalista/Seleccionado', 'Otro']
}

def generate_lead(i):
    # Generar valores numéricos exactos
    asist = random.randint(0, 10)
    clicks = random.randint(0, 20)
    recencia = random.randint(0, 180)
    antiguo = random.choice([0, 1])
    
    # Valores categóricos
    sector = random.choice(CATEGORIES['situacion_laboral'])
    marketing = random.choice(CATEGORIES['clicks_marketing'])
    prof = random.choice(CATEGORIES['profesion'])
    region = random.choice(CATEGORIES['ubicacion_region'])
    entidad = random.choice(CATEGORIES['tipo_entidad_interes'])
    postulacion = random.choice(CATEGORIES['estado_postulacion_historica'])

    # Lógica de negocio inventada pero realista
    prob = 0.05
    if asist >= 3:
        prob += 0.3
    if antiguo == 1:
        prob += 0.2
    if recencia < 14:
        prob += 0.15
    if clicks > 5:
        prob += 0.1
    if postulacion == 'Postulante frecuente':
        prob += 0.1
    if sector == 'sector_publico':
        prob += 0.1

    # Ruido
    prob += random.uniform(-0.1, 0.1)
    compro = 1 if prob >= 0.5 else 0

    return {
        "asistencia_webinars": {"integerValue": str(asist)},
        "clicks_bolsa_trabajo": {"integerValue": str(clicks)},
        "situacion_laboral": {"stringValue": sector},
        "clicks_marketing": {"stringValue": marketing},
        "profesion": {"stringValue": prof},
        "recencia_interaccion": {"integerValue": str(recencia)},
        "cliente_antiguo": {"integerValue": str(antiguo)},
        "ubicacion_region": {"stringValue": region},
        "tipo_entidad_interes": {"stringValue": entidad},
        "estado_postulacion_historica": {"stringValue": postulacion},
        "compro_curso": {"integerValue": str(compro)}
    }

N = 2500
BATCH_SIZE = 400

for b in range(0, N, BATCH_SIZE):
    writes = []
    for i in range(b, min(b + BATCH_SIZE, N)):
        writes.append({
            "update": {
                "name": f"projects/{project_id}/databases/(default)/documents/leads/USR-{i}",
                "fields": generate_lead(i)
            }
        })
    
    data = json.dumps({"writes": writes}).encode('utf-8')
    req = urllib.request.Request(url, data=data, headers={'Content-Type': 'application/json'}, method='POST')
    try:
        with urllib.request.urlopen(req) as response:
            print(f"Batch {b} - {b+BATCH_SIZE} guardado.")
    except Exception as e:
        print(f"Error en batch {b}: {e}")

print("Terminado.")
