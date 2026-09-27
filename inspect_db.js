const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const debts = await prisma.debt.findMany({ include: { cuenta: true } });
  const transactions = await prisma.transaction.findMany({ orderBy: { fecha_transaccion: 'desc' } });
  
  console.log('=== ALL DEBTS (' + debts.length + ') ===');
  debts.forEach(d => {
    console.log(`[DEBT ${d.id}] ${d.cuenta?.nombre} | Saldo: $${d.saldo_total} | Cuota: $${d.pago_minimo} | Limite: ${d.fecha_limite_pago?.toISOString().slice(0,10)} | Cubierto: ${d.cubierto_por || 'NO'}`);
  });

  console.log('\n=== ALL TRANSACTIONS (' + transactions.length + ') ===');
  transactions.forEach(t => {
    console.log(`[TX ${t.id}] ${t.tipo} | $${t.monto} | "${t.descripcion}" | Fecha: ${t.fecha_transaccion?.toISOString().slice(0,10)} | Km: ${t.kilometraje}`);
  });
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
