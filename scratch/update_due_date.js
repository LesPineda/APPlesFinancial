const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');
const prisma = new PrismaClient();

async function updateDueDate() {
  console.log('🚀 Actualizando fecha límite de pago para Crédito Unificado al día 14...');

  const acc = await prisma.account.findUnique({
    where: { nombre: 'Crédito Unificado' }
  });

  if (!acc) {
    console.error('❌ No se encontró la cuenta Crédito Unificado.');
    return;
  }

  const updatedDebt = await prisma.debt.updateMany({
    where: { cuenta_id: acc.id },
    data: {
      fecha_corte: new Date('2026-10-04T00:00:00.000Z'),
      fecha_limite_pago: new Date('2026-10-14T00:00:00.000Z')
    }
  });

  console.log('✅ Fecha actualizada:', updatedDebt);

  // Actualizar dump.json
  const cuentas = await prisma.account.findMany();
  const deudas = await prisma.debt.findMany();
  const transacciones = await prisma.transaction.findMany();

  const data = { cuentas, deudas, transacciones };
  fs.writeFileSync(path.join(__dirname, 'dump.json'), JSON.stringify(data, null, 2), 'utf-8');
  console.log('✅ dump.json re-sincronizado.');
}

updateDueDate().catch(console.error).finally(() => prisma.$disconnect());
