const path = require('path');
const dbPath = path.resolve(__dirname, '../prisma/dev.db').replace(/\\/g, '/');
process.env.DATABASE_URL = `file:${dbPath}`;

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
  const debts = await prisma.debt.findMany({ include: { cuenta: true } });
  const activeDebts = debts.filter(d => Number(d.saldo_total) > 0);

  let totalCuotasFijas = 0;
  console.log('--- DEUDAS ACTIVAS Y SUS CUOTAS (PAGO MINIMO) ---');
  activeDebts.forEach(d => {
    const name = d.cuenta ? d.cuenta.nombre : 'Deuda';
    const cuota = Number(d.pago_minimo);
    totalCuotasFijas += cuota;
    console.log(`- ${name}: Pago mínimo = $${cuota.toLocaleString('es-CO')}, Saldo = $${Number(d.saldo_total).toLocaleString('es-CO')}, Cubierto: ${d.cubierto_por || 'No'}`);
  });

  console.log('\n=============================================');
  console.log(`TOTAL CUOTAS MENSUALES REGISTRADAS: $${totalCuotasFijas.toLocaleString('es-CO')}`);
  console.log('=============================================');
}

run().finally(() => prisma.$disconnect());
