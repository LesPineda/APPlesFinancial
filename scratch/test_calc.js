const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const accounts = await prisma.account.findMany();
  const debts = await prisma.debt.findMany({ include: { cuenta: true } });
  const transactions = await prisma.transaction.findMany({ include: { cuenta: true } });

  const liquid = accounts.filter(a => ['DEBITO', 'EFECTIVO'].includes(a.tipo)).reduce((s, a) => s + Number(a.saldo_actual), 0);
  console.log('Liquid Total (Bancos/Efectivo):', liquid);

  const activeDebts = debts.filter(d => Number(d.saldo_total) > 0);

  const q1Debts = activeDebts.filter(d => {
    const date = new Date(d.fecha_limite_pago);
    const day = date.getUTCDate();
    return day >= 1 && day <= 14;
  });

  const q2Debts = activeDebts.filter(d => {
    const date = new Date(d.fecha_limite_pago);
    const day = date.getUTCDate();
    return day >= 15 && day <= 31;
  });

  // Total cuotas fijas a tu cargo (no cubiertas) en Q1 y Q2
  const q1CuotasTotal = q1Debts.reduce((s, d) => s + (d.cubierto_por ? 0 : Number(d.pago_minimo)), 0);
  const q2CuotasTotal = q2Debts.reduce((s, d) => s + (d.cubierto_por ? 0 : Number(d.pago_minimo)), 0);

  console.log('Q1 Cuotas Total (fijas):', q1CuotasTotal);
  console.log('Q2 Cuotas Total (fijas):', q2CuotasTotal);

  const q1Income = 3434375;
  const q2Income = 2696444;

  console.log('Q1 Proyectado (Ingreso - Cuotas Fijas):', q1Income - q1CuotasTotal);
  console.log('Q2 Proyectado (Ingreso - Cuotas Fijas):', q2Income - q2CuotasTotal);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
