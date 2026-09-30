const path = require('path');
const dbPath = path.resolve(__dirname, '../prisma/dev.db').replace(/\\/g, '/');
process.env.DATABASE_URL = `file:${dbPath}`;

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
  const transactions = await prisma.transaction.findMany({ include: { cuenta: true } });
  const debts = await prisma.debt.findMany({ include: { cuenta: true } });

  const debtAccountIds = new Set(debts.map(d => d.cuenta_id).filter(Boolean));
  const debtAccountNamesClean = debts.map(d => {
    if (!d.cuenta) return '';
    return d.cuenta.nombre.toLowerCase().trim();
  }).filter(Boolean);

  const currentYear = 2026;
  const currentMonth = 8; // Sept

  let totalGastos = 0;
  let gastosFijosDeudas = 0;
  let gastosVariosVariables = 0;

  console.log('--- DESGLOSE DE GASTOS EJECUTADOS EN SEPTIEMBRE ---');
  transactions.forEach(t => {
    if (t.tipo !== 'GASTO') return;
    const txDate = new Date(t.fecha_transaccion);
    if (txDate.getFullYear() === currentYear && txDate.getMonth() === currentMonth) {
      const monto = Number(t.monto);
      totalGastos += monto;

      const desc = (t.descripcion || '').toLowerCase().trim();
      const accName = (t.cuenta ? t.cuenta.nombre : '').toLowerCase().trim();

      const isDebtAccount = debtAccountIds.has(t.cuenta_id);
      const isDebtName = debtAccountNamesClean.some(name => {
        if (!name) return false;
        if (name === 'gas' || name === 'luz') {
          const words = (desc + ' ' + accName).split(/\s+/);
          return words.includes(name);
        }
        return desc.includes(name) || accName.includes(name);
      });
      const isExplicitDebtKeyword = desc.includes('pago cuota') || desc.includes('arriendo') || desc.includes('plan tigo');

      if (isDebtAccount || isDebtName || isExplicitDebtKeyword) {
        gastosFijosDeudas += monto;
        console.log(`📌 [GASTO FIJO / CUOTA]: ${t.descripcion} ($${monto.toLocaleString('es-CO')})`);
      } else {
        gastosVariosVariables += monto;
        console.log(`🛒 [GASTO VARIO / NO FIJO]: ${t.descripcion} ($${monto.toLocaleString('es-CO')})`);
      }
    }
  });

  console.log('\n=============================================');
  console.log(`TOTAL GASTOS REALIZADOS MES: $${totalGastos.toLocaleString('es-CO')}`);
  console.log(`• GASTOS FIJOS / DEUDAS (Cuotas): $${gastosFijosDeudas.toLocaleString('es-CO')}`);
  console.log(`• GASTOS VARIOS / NO FIJOS (Libres): $${gastosVariosVariables.toLocaleString('es-CO')}`);
  console.log('=============================================');
}

run().finally(() => prisma.$disconnect());
