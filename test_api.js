import fs from 'fs';
import Papa from 'papaparse';

const csv = fs.readFileSync('sample_leads.csv', 'utf8');
const parsed = Papa.parse(csv, { header: true, skipEmptyLines: true });
console.log("Parsed row 0:", parsed.data[0]);

fetch('http://127.0.0.1:8000/predict', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(parsed.data)
}).then(res => res.json()).then(data => console.log(JSON.stringify(data, null, 2))).catch(err => console.error(err));
