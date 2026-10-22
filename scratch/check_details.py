import json
import sqlite3

with open('scratch/supabase_data.json', 'r', encoding='utf-8') as f:
    su = json.load(f)

conn = sqlite3.connect('prisma/dev.db')
conn.row_factory = sqlite3.Row
cur = conn.cursor()
sq_accounts = {r['nombre']: dict(r) for r in cur.execute('SELECT * FROM cuentas').fetchall()}
sq_debts = {r['cuenta_id']: dict(r) for r in cur.execute('SELECT * FROM deudas').fetchall()}

print("=== DETALLE DE CUENTAS (COMPARACIÓN) ===")
print(f"{'Nombre':24} | {'Saldo SQLite':15} | {'Saldo Supabase':15} | {'Updated SQLite':24} | {'Updated Supabase':24}")
print("-" * 115)

for a in su['accounts']:
    nombre = a['nombre']
    sq = sq_accounts.get(nombre, {})
    sq_saldo = f"${float(sq.get('saldo_actual', 0)):,.2f}" if sq else "NO EXISTE"
    su_saldo = f"${float(a['saldo_actual']):,.2f}"
    sq_up = str(sq.get('updatedAt', ''))[:19]
    su_up = str(a.get('updatedAt', ''))[:19]
    diff = " [DIFERENCIA]" if sq and abs(float(sq.get('saldo_actual', 0)) - float(a['saldo_actual'])) > 0.01 else ""
    print(f"{nombre:24} | {sq_saldo:15} | {su_saldo:15} | {sq_up:24} | {su_up:24}{diff}")

print("\n=== TRANSACCIONES QUE ESTÁN EN SQLITE PERO NO EN SUPABASE ===")
sq_txs = [dict(r) for r in cur.execute('SELECT * FROM transacciones').fetchall()]
su_tx_keys = set((t['tipo'], float(t['monto']), t['descripcion'].strip().lower()) for t in su['transactions'])

for t in sq_txs:
    key = (t['tipo'], float(t['monto']), t['descripcion'].strip().lower())
    if key not in su_tx_keys:
        # find account
        cur.execute("SELECT nombre FROM cuentas WHERE id = ?", (t['cuenta_id'],))
        row = cur.fetchone()
        acc = row['nombre'] if row else t['cuenta_id']
        print(f"-> Fecha: {str(t['fecha_transaccion'])[:10]} | Tipo: {t['tipo']} | Monto: ${float(t['monto']):,.2f} | Cuenta: {acc} | Desc: {t['descripcion']}")

print("\n=== DETALLE DE DEUDAS (COMPARACIÓN) ===")
print(f"{'Cuenta':24} | {'Total SQLite':15} | {'Total Supabase':15} | {'Cuota SQLite':15} | {'Cuota Supabase':15} | {'Updated Supabase':24}")
print("-" * 120)

for d in su['debts']:
    c_nombre = d['cuenta']['nombre'] if d.get('cuenta') else 'N/A'
    sq = sq_debts.get(d['cuenta_id'])
    sq_tot = f"${float(sq['saldo_total']):,.2f}" if sq else "N/A"
    su_tot = f"${float(d['saldo_total']):,.2f}"
    sq_cuo = f"${float(sq['pago_minimo']):,.2f}" if sq else "N/A"
    su_cuo = f"${float(d['pago_minimo']):,.2f}"
    su_up = str(d.get('updatedAt', ''))[:19]
    diff = " [DIFERENCIA]" if sq and (abs(float(sq['saldo_total']) - float(d['saldo_total'])) > 0.01 or abs(float(sq['pago_minimo']) - float(d['pago_minimo'])) > 0.01) else ""
    print(f"{c_nombre:24} | {sq_tot:15} | {su_tot:15} | {sq_cuo:15} | {su_cuo:15} | {su_up:24}{diff}")
