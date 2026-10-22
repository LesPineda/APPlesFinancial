import sqlite3
import json
from datetime import datetime

def format_date(d):
    if d is None:
        return 'N/A'
    if isinstance(d, (int, float)):
        if d > 1e11:
            d = d / 1000
        return datetime.utcfromtimestamp(d).strftime('%Y-%m-%d')
    return str(d)[:10]

with open('scratch/supabase_data.json', 'r', encoding='utf-8') as f:
    su = json.load(f)

conn = sqlite3.connect('prisma/dev.db')
conn.row_factory = sqlite3.Row
cur = conn.cursor()
sq_txs = [dict(r) for r in cur.execute('SELECT * FROM transacciones').fetchall()]

print('--- SQLITE (LOCAL) TXS (Total:', len(sq_txs), ') ---')
for t in sorted(sq_txs, key=lambda x: (format_date(x.get('fecha_transaccion')), x['descripcion'])):
    print(f"{t['id'][:8]} | {format_date(t.get('fecha_transaccion'))} | {t['tipo']:7} | ${float(t['monto']):10.2f} | {t['descripcion']} (created: {format_date(t.get('createdAt'))})")

print('\n--- SUPABASE TXS (Total:', len(su['transactions']), ') ---')
for t in sorted(su['transactions'], key=lambda x: (format_date(x.get('fecha_transaccion')), x['descripcion'])):
    print(f"{t['id'][:8]} | {format_date(t.get('fecha_transaccion'))} | {t['tipo']:7} | ${float(t['monto']):10.2f} | {t['descripcion']} (created: {format_date(t.get('createdAt'))})")
