import csv
import random
import os

CATEGORIES = {
    'situacion_laboral': ['sector_privado', 'independiente', 'sector_publico'],
    'clicks_marketing': ['nula', 'media', 'alta'],
    'profesion': ['Profesor', 'Medico', 'Ingeniero', 'Arquitecto', 'Contador', 'Abogado', 'Administrador', 'Economista', 'Otro'],
    'ubicacion_region': ['Lima', 'Callao', 'Cusco', 'Piura', 'Arequipa', 'Otro'],
    'tipo_entidad_interes': ['Ministerios/Poder Ejecutivo', 'Gobierno Regional', 'Municipalidades', 'Organismos Autónomos', 'Otro'],
    'estado_postulacion_historica': ['Solo visualizador', 'Postulante frecuente', 'Finalista/Seleccionado', 'Otro']
}

def generate_lead(i):
    asist = random.randint(0, 10)
    clicks = random.randint(0, 20)
    recencia = random.randint(0, 180)
    antiguo = random.choice([0, 1])
    
    sector = random.choice(CATEGORIES['situacion_laboral'])
    marketing = random.choice(CATEGORIES['clicks_marketing'])
    prof = random.choice(CATEGORIES['profesion'])
    region = random.choice(CATEGORIES['ubicacion_region'])
    entidad = random.choice(CATEGORIES['tipo_entidad_interes'])
    postulacion = random.choice(CATEGORIES['estado_postulacion_historica'])

    prob = 0.05
    if asist >= 3: prob += 0.3
    if antiguo == 1: prob += 0.2
    if recencia < 14: prob += 0.15
    if clicks > 5: prob += 0.1
    if postulacion == 'Postulante frecuente': prob += 0.1
    if sector == 'sector_publico': prob += 0.1

    prob += random.uniform(-0.1, 0.1)
    compro = 1 if prob >= 0.5 else 0

    return {
        "id_user": f"HIST-{i}",
        "asistencia_webinars": asist,
        "clicks_bolsa_trabajo": clicks,
        "situacion_laboral": sector,
        "clicks_marketing": marketing,
        "profesion": prof,
        "recencia_interaccion": recencia,
        "cliente_antiguo": antiguo,
        "ubicacion_region": region,
        "tipo_entidad_interes": entidad,
        "estado_postulacion_historica": postulacion,
        "compro_curso": compro
    }

N = 2500
filename = 'historico_entrenamiento.csv'

with open(filename, 'w', newline='', encoding='utf-8') as f:
    writer = csv.DictWriter(f, fieldnames=[
        "id_user", "asistencia_webinars", "clicks_bolsa_trabajo", "situacion_laboral",
        "clicks_marketing", "profesion", "recencia_interaccion", "cliente_antiguo",
        "ubicacion_region", "tipo_entidad_interes", "estado_postulacion_historica", "compro_curso"
    ])
    writer.writeheader()
    for i in range(N):
        writer.writerow(generate_lead(i))

print(f"Archivo {filename} generado exitosamente.")
