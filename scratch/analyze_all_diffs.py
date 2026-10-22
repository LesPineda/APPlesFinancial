import sqlite3
import json
from datetime import datetime

def parse_date(d):
    if d is None:
        return 'N/A'
    if isinstance(d, (int, float)):
        if d > 1e11:
            d = d / 1000
        return datetime.utcfromtimestamp(d).strftime('%Y-%m-%d %H:%M')
    return str(d)[:16].replace('T', ' ')

with open('scratch/supabase_data.json', 'r', encoding='utf-8') as f:
    su = json.load(f)

conn = sqlite3.connect('prisma/dev.db')
conn.row_factory = sqlite3.Row
cur = conn.cursor()

sq_accounts = {r['nombre']: dict(r) for r in cur.execute('SELECT * FROM cuentas').fetchall()}
sq_debts = {r['cuenta_id']: dict(r) for r in cur.execute('SELECT * FROM deudas').fetchall()}
sq_txs = [dict(r) for r in cur.execute('SELECT * FROM transacciones').fetchall()]

print("="*80)
print("1. RESUMEN GLOBAL")
print(f"   SQLite (Local):   {len(sq_accounts)} cuentas | {len(sq_debts)} deudas | {len(sq_txs)} transacciones")
print(f"   Supabase (Nube):   {len(su['accounts'])} cuentas | {len(su['debts'])} deudas | {len(su['transactions'])} transacciones")
print("="*80)

print("\n2. TRANSACCIONES QUE SÓLO ESTÁN EN SQLITE (LOCAL):")
su_tx_ids = set(t['id'] for t in su['transactions'])
su_tx_signatures = set((t['tipo'], float(t['monto']), t['descripcion'].strip().lower(), str(t['fecha_transaccion'])[:10]) for t in su['transactions'])

sq_only_tx = []
for t in sq_txs:
    sig = (t['tipo'], float(t['monto']), t['descripcion'].strip().lower(), parse_date(t['fecha_transaccion'])[:10])
    if sig not in su_tx_signatures and t['id'] not in su_tx_ids:
        cur.execute("SELECT nombre FROM cuentas WHERE id = ?", (t['cuenta_id'],))
        row = cur.fetchone()
        t_copy = dict(t)
        t_copy['cuenta_nombre'] = row['nombre'] if row else t['cuenta_id']
        sq_only_tx.append(t_copy)

if sq_only_tx:
    for t in sq_only_tx:
        print(f"   + [Fecha {parse_date(t['fecha_transaccion'])[:10]}] {t['tipo']} ${float(t['monto']):,.2f} | Cuenta: {t['cuenta_nombre']} | Desc: \"{t['descripcion']}\"")
else:
    print("   (Ninguna transacción exclusiva en SQLite)")

print("\n3. TRANSACCIONES QUE SÓLO ESTÁN EN SUPABASE (NUBE):")
sq_tx_ids = set(t['id'] for t in sq_txs)
sq_tx_signatures = set((t['tipo'], float(t['monto']), t['descripcion'].strip().lower(), parse_date(t['fecha_transaccion'])[:10]) for t in sq_txs)

su_only_tx = []
for t in su['transactions']:
    sig = (t['tipo'], float(t['monto']), t['descripcion'].strip().lower(), str(t['fecha_transaccion'])[:10])
    if sig not in sq_tx_signatures and t['id'] not in sq_tx_ids:
        su_only_tx.append(t)

if su_only_tx:
    for t in su_only_tx:
        acc = t.get('cuenta', {}).get('nombre', t['cuenta_id'])
        print(f"   + [Fecha {str(t['fecha_transaccion'])[:10]}] {t['tipo']} ${float(t['monto']):,.2f} | Cuenta: {acc} | Desc: \"{t['descripcion']}\"")
else:
    print("   (Ninguna transacción exclusiva en Supabase)")

print("\n4. DIFERENCIAS EN SALDOS DE CUENTAS:")
for a in sorted(su['accounts'], key=lambda x: x['nombre']):
    nombre = a['nombre']
    sq = sq_accounts.get(nombre)
    if not sq:
        continue
    sq_bal = float(sq['saldo_actual'])
    su_bal = float(a['saldo_actual'])
    if abs(sq_bal - su_bal) > 0.01:
        print(f"   * {nombre:22}: SQLite = ${sq_bal:>12,.2f}  |  Supabase = ${su_bal:>12,.2f}  |  Dif = ${sq_bal - su_bal:>12,.2f}")

print("\n5. DIFERENCIAS EN DEUDAS (SALDO TOTAL / CUOTA):")
for d in su['debts']:
    c_nombre = d['cuenta']['nombre'] if d.get('cuenta') else d['cuenta_id']
    sq = sq_debts.get(d['cuenta_id'])
    if not sq:
        continue
    sq_tot = float(sq['saldo_total'])
    su_tot = float(d['saldo_total'])
    sq_cuo = float(sq['pago_minimo'])
    su_cuo = float(d['pago_minimo'])
    if abs(sq_tot - su_tot) > 0.01 or abs(sq_cuo - su_cuo) > 0.01:
        print(f"   * {c_nombre:22}:")
        if abs(sq_tot - su_tot) > 0.01:
            print(f"       Saldo Total: SQLite = ${sq_tot:,.2f} vs Supabase = ${su_tot:,.2f} (Dif: ${sq_tot - su_tot:,.2f})")
        if abs(sq_cuo - su_cuo) > 0.01:
            print(f"       Pago Mínimo: SQLite = ${sq_cuo:,.2f} vs Supabase = ${su_cuo:,.2f} (Dif: ${sq_cuo - su_cuo:,.2f})")
