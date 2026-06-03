import re

with open('backend/main.py', 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Imports
content = content.replace('from sklearn.ensemble import GradientBoostingClassifier', 'from sklearn.ensemble import RandomForestClassifier')
content = content.replace('from sklearn.calibration import CalibratedClassifierCV\n', '')

# 2. Remove get_deterministic_score completely
content = re.sub(r'def get_deterministic_score.*?return min\(score, 100\)\n', '', content, flags=re.DOTALL)

# 3. Add compro_curso reading for Firebase
old_firebase = """            rows['estado_postulacion_historica'].append(get_val('estado_postulacion_historica', 'Otro'))"""
new_firebase = """            rows['estado_postulacion_historica'].append(get_val('estado_postulacion_historica', 'Otro'))
            
            # NUEVO: Leer la variable objetivo (target) real
            y_val = get_val('compro_curso', 0, 'integerValue')
            if 'compro_curso' not in rows:
                rows['compro_curso'] = []
            rows['compro_curso'].append(y_val)"""
content = content.replace(old_firebase, new_firebase)

# 4. Add compro_curso for synthetic
old_synth = """            'estado_postulacion_historica': np.random.choice(CATEGORIES['estado_postulacion_historica'], N),
        }"""
new_synth = """            'estado_postulacion_historica': np.random.choice(CATEGORIES['estado_postulacion_historica'], N),
            'compro_curso': np.random.binomial(1, 0.3, N),
        }"""
content = content.replace(old_synth, new_synth)

# 5. Replace Target y generation
old_y_gen = """    # Compute deterministic scores
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
    y = np.random.binomial(1, p_noisy)"""
new_y_gen = """    # Usar la variable objetivo real
    if 'compro_curso' in rows:
        y = np.array(rows['compro_curso'])
    else:
        y = np.random.binomial(1, 0.3, N) # Fallback seguro"""
content = content.replace(old_y_gen, new_y_gen)

# 6. Replace Model Training
old_model = """    # Train Gradient Boosting
    base = GradientBoostingClassifier(
        n_estimators=200,
        learning_rate=0.05,
        max_depth=4,
        subsample=0.8,
        random_state=42
    )
    model = CalibratedClassifierCV(base, method='isotonic', cv=min(5, N))
    model.fit(X.values, y)"""
new_model = """    # Entrenar RandomForest
    model = RandomForestClassifier(
        n_estimators=100,
        max_depth=10,
        random_state=42
    )
    model.fit(X.values, y)"""
content = content.replace(old_model, new_model)

# 7. Remove _blend
content = re.sub(r'def _blend.*?return int\(round\(min\(blended, 100\)\)\)\n', '', content, flags=re.DOTALL)

# 8. Update endpoint predictions
old_endpoint = """        det_score = get_deterministic_score(norm_row)
        ml_prob = _ml_predict_single(norm_row)
        final_prob = _blend(det_score, ml_prob)"""
new_endpoint = """        ml_prob = _ml_predict_single(norm_row)
        final_prob = int(round(ml_prob))"""
content = content.replace(old_endpoint, new_endpoint)

# 9. Update endpoint score assignment
content = content.replace('score=det_score,', 'score=final_prob, # Igualamos score a prob')

with open('backend/main.py', 'w', encoding='utf-8') as f:
    f.write(content)
print('Done!')
