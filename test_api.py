import requests
import csv

with open('sample_leads.csv', 'r', encoding='utf-8') as f:
    reader = csv.DictReader(f)
    leads = list(reader)

res = requests.post('http://127.0.0.1:8000/predict', json=leads)
print(res.status_code)
print(res.text)
