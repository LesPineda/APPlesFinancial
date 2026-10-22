import sqlite3
import json
import os
from decimal import Decimal

sqlite_path = 'prisma/dev.db'
supabase_json_path = 'scratch/supabase_data.json'

if not os.path.exists(sqlite_path):
    print("SQLite database prisma/dev.db does not exist!")
    exit(1)

with open(supabase_json_path, 'r', encoding='utf-8') as f:
    supabase_data = json.load(f)

conn = sqlite3.connect(sqlite_path)
conn.row_factory = sqlite3.Row
cur = conn.cursor()

# Get sqlite accounts
cur.execute("SELECT * FROM cuentas")
sqlite_accounts = [dict(r) for r in cur.fetchall()]

# Get sqlite debts
cur.execute("SELECT * FROM deudas")
sqlite_debts = [dict(r) for r in cur.fetchall()]

# Get sqlite transactions
cur.execute("SELECT * FROM transacciones")
sqlite_txs = [dict(r) for r in cur.fetchall()]

print("="*60)
print("RESUMEN DE REGISTROS:")
print(f"  Cuentas:       SQLite = {len(sqlite_accounts)} | Supabase = {len(supabase_data['accounts'])}")
print(f"  Deudas:        SQLite = {len(sqlite_debts)} | Supabase = {len(supabase_data['debts'])}")
print(f"  Transacciones: SQLite = {len(sqlite_txs)} | Supabase = {len(supabase_data['transactions'])}")
print("="*60)

# Compare Transactions
print("\n--- COMPARATIVA DE TRANSACCIONES ---")
sq_tx_by_id = {t['id']: t for t in sqlite_txs}
su_tx_by_id = {t['id']: t for t in supabase_data['transactions']}

only_in_sqlite = [t for tid, t in sq_tx_by_id.items() if tid not in su_tx_by_id]
only_in_supabase = [t for tid, t in su_tx_by_id.items() if tid not in sq_tx_by_id]

from datetime import datetime

def format_date(d):
    if d is None:
        return 'N/A'
    if isinstance(d, (int, float)):
        # check if milliseconds
        if d > 1e11:
            d = d / 1000
        return datetime.utcfromtimestamp(d).strftime('%Y-%m-%d')
    return str(d)[:10]

print(f"Transacciones sólo en SQLite (Local): {len(only_in_sqlite)}")
for t in only_in_sqlite:
    print(f"  [SQLite Only] {format_date(t.get('fecha_transaccion'))} | {t.get('tipo')} | ${t.get('monto')} | {t.get('descripcion')}")

print(f"Transacciones sólo en Supabase: {len(only_in_supabase)}")
for t in only_in_supabase:
    print(f"  [Supabase Only] {format_date(t.get('fecha_transaccion'))} | {t.get('tipo')} | ${t.get('monto')} | {t.get('descripcion')}")

# Dates of latest transactions
if sqlite_txs:
    latest_sq_date = max(format_date(t.get('fecha_transaccion')) for t in sqlite_txs)
    latest_sq_created = max(format_date(t.get('createdAt')) for t in sqlite_txs)
    print(f"\nÚltima fecha de transacción en SQLite: {latest_sq_date} (creada: {latest_sq_created})")
if supabase_data['transactions']:
    latest_su_date = max(format_date(t.get('fecha_transaccion')) for t in supabase_data['transactions'])
    latest_su_created = max(format_date(t.get('createdAt')) for t in supabase_data['transactions'])
    print(f"Última fecha de transacción en Supabase: {latest_su_date} (creada: {latest_su_created})")

# Compare Accounts
print("\n--- COMPARATIVA DE CUENTAS Y SALDOS ---")
sq_acc_by_id = {a['id']: a for a in sqlite_accounts}
su_acc_by_id = {a['id']: a for a in supabase_data['accounts']}

sq_acc_by_name = {a['nombre']: a for a in sqlite_accounts}
su_acc_by_name = {a['nombre']: a for a in supabase_data['accounts']}

diff_balances = []
all_names = sorted(set(sq_acc_by_name.keys()) | set(su_acc_by_name.keys()))
for name in all_names:
    sq = sq_acc_by_name.get(name)
    su = su_acc_by_name.get(name)
    if not sq:
        print(f"  [Solo en Supabase] Cuenta: {name} (Saldo: ${su['saldo_actual']})")
    elif not su:
        print(f"  [Solo en SQLite] Cuenta: {name} (Saldo: ${sq['saldo_actual']})")
    else:
        sq_bal = float(sq['saldo_actual'])
        su_bal = float(su['saldo_actual'])
        if abs(sq_bal - su_bal) > 0.01:
            diff_balances.append({
                'nombre': name,
                'sqlite_balance': sq_bal,
                'supabase_balance': su_bal,
                'sqlite_updated': format_date(sq.get('updatedAt')),
                'supabase_updated': format_date(su.get('updatedAt'))
            })

if diff_balances:
    print(f"Cuentas con saldo diferente ({len(diff_balances)}):")
    for d in diff_balances:
        print(f"  * {d['nombre']}: SQLite=${d['sqlite_balance']} vs Supabase=${d['supabase_balance']} (updatedAt SQLite: {d['sqlite_updated']} | Supabase: {d['supabase_updated']})")
else:
    print("Todas las cuentas existentes en ambos lados tienen exactamente el mismo saldo.")

# Compare Debts
print("\n--- COMPARATIVA DE DEUDAS ---")
sq_debt_by_id = {d['id']: d for d in sqlite_debts}
su_debt_by_id = {d['id']: d for d in supabase_data['debts']}

diff_debts = []
for did, sq_d in sq_debt_by_id.items():
    su_d = su_debt_by_id.get(did)
    if not su_d:
        continue
    sq_total = float(sq_d['saldo_total'])
    su_total = float(su_d['saldo_total'])
    sq_cuota = float(sq_d['pago_minimo'])
    su_cuota = float(su_d['pago_minimo'])
    if abs(sq_total - su_total) > 0.01 or abs(sq_cuota - su_cuota) > 0.01:
        # find account name
        acc_name = sq_acc_by_id.get(sq_d['cuenta_id'], {}).get('nombre', 'Desconocida')
        diff_debts.append({
            'cuenta': acc_name,
            'sq_total': sq_total,
            'su_total': su_total,
            'sq_cuota': sq_cuota,
            'su_cuota': su_cuota,
            'sq_updated': format_date(sq_d.get('updatedAt')),
            'su_updated': format_date(su_d.get('updatedAt')),
        })

if diff_debts:
    print(f"Deudas con diferencias ({len(diff_debts)}):")
    for d in diff_debts:
        print(f"  * {d['cuenta']}:")
        print(f"      Saldo Total: SQLite=${d['sq_total']} vs Supabase=${d['su_total']}")
        print(f"      Cuota/Pago mín: SQLite=${d['sq_cuota']} vs Supabase=${d['su_cuota']}")
        print(f"      UpdatedAt: SQLite={d['sq_updated']} | Supabase={d['su_updated']}")
else:
    print("Todas las deudas tienen exactamente los mismos montos en ambos lados.")
