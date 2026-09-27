const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');
const prisma = new PrismaClient();

async function exportDump() {
  const cuentas = await prisma.account.findMany();
  const deudas = await prisma.debt.findMany();
  const transacciones = await prisma.transaction.findMany();

  const data = { cuentas, deudas, transacciones };
  fs.writeFileSync(path.join(__dirname, 'dump.json'), JSON.stringify(data, null, 2), 'utf-8');
  console.log('✅ scratch/dump.json actualizado con la unificación de deudas.');
}

exportDump().catch(console.error).finally(() => prisma.$disconnect());
