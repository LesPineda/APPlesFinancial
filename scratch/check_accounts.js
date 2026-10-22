const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const accounts = await prisma.account.findMany();
  console.log('--- ACCOUNTS ---');
  accounts.forEach(a => {
    console.log(`[${a.id}] ${a.nombre} (${a.tipo}) -> Saldo actual: $${a.saldo_actual}`);
  });

  const debts = await prisma.debt.findMany({ include: { cuenta: true } });
  console.log('\n--- DEBTS ---');
  debts.forEach(d => {
    console.log(`[DEBT] ${d.cuenta?.nombre} -> Saldo total: $${d.saldo_total} | Cuota: $${d.pago_minimo}`);
  });

  const txs = await prisma.transaction.findMany({ orderBy: { fecha_transaccion: 'desc' } });
  console.log('\n--- TRANSACTIONS ---');
  txs.forEach(t => {
    console.log(`[TX ${t.fecha_transaccion.toISOString().slice(0, 10)}] ${t.tipo} $${t.monto} - "${t.descripcion}" (Cuenta ID: ${t.cuenta_id})`);
  });
}

main().catch(console.error).finally(() => prisma.$disconnect());
