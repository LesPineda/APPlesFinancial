import sqlite3
import json
from datetime import datetime

conn = sqlite3.connect('prisma/dev.db')
conn.row_factory = sqlite3.Row
cur = conn.cursor()

def to_iso(val):
    if val is None:
        return None
    if isinstance(val, (int, float)):
        # If timestamp is in seconds vs milliseconds
        sec = val / 1000.0 if val > 1e11 else float(val)
        return datetime.utcfromtimestamp(sec).isoformat() + 'Z'
    s = str(val).strip()
    if s.isdigit():
        sec = float(s) / 1000.0 if float(s) > 1e11 else float(s)
        return datetime.utcfromtimestamp(sec).isoformat() + 'Z'
    return s

cuentas = [dict(r) for r in cur.execute('SELECT * FROM cuentas').fetchall()]
deudas = [dict(r) for r in cur.execute('SELECT * FROM deudas').fetchall()]
transacciones = [dict(r) for r in cur.execute('SELECT * FROM transacciones').fetchall()]

# Format timestamps
for c in cuentas:
    c['saldo_actual'] = float(c['saldo_actual'])
    c['createdAt'] = to_iso(c.get('createdAt'))
    c['updatedAt'] = to_iso(c.get('updatedAt'))

for d in deudas:
    d['saldo_total'] = float(d['saldo_total'])
    d['tasa_interes_ea'] = float(d['tasa_interes_ea'])
    d['pago_minimo'] = float(d['pago_minimo'])
    d['fecha_corte'] = to_iso(d.get('fecha_corte'))
    d['fecha_limite_pago'] = to_iso(d.get('fecha_limite_pago'))
    d['createdAt'] = to_iso(d.get('createdAt'))
    d['updatedAt'] = to_iso(d.get('updatedAt'))

for t in transacciones:
    t['monto'] = float(t['monto'])
    t['fecha_transaccion'] = to_iso(t.get('fecha_transaccion'))
    t['createdAt'] = to_iso(t.get('createdAt'))
    t['updatedAt'] = to_iso(t.get('updatedAt'))

out = {
    'cuentas': cuentas,
    'deudas': deudas,
    'transacciones': transacciones
}

with open('scratch/sqlite_clean_dump.json', 'w', encoding='utf-8') as f:
    json.dump(out, f, indent=2, ensure_ascii=False)

print(f"Exported from SQLite to scratch/sqlite_clean_dump.json:")
print(f"- Cuentas: {len(cuentas)}")
print(f"- Deudas: {len(deudas)}")
print(f"- Transacciones: {len(transacciones)}")
