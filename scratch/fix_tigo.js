const path = require('path');
const dbPath = path.resolve(__dirname, '../prisma/dev.db').replace(/\\/g, '/');
process.env.DATABASE_URL = `file:${dbPath}`;
console.log('DATABASE_URL:', process.env.DATABASE_URL);

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
  const tigo = await prisma.debt.findFirst({ where: { cuenta: { nombre: 'Plan Tigo' } } });
  if (tigo) {
    await prisma.debt.update({
      where: { id: tigo.id },
      data: { fecha_limite_pago: new Date('2026-09-25T05:00:00.000Z') }
    });
    console.log('Successfully updated Plan Tigo due date to Sept 25, 2026 in prisma/dev.db');
  } else {
    console.log('Plan Tigo not found');
  }
}

run()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
