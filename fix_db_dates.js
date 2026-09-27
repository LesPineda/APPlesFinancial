const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function fixPaidDebts() {
  console.log('Fixing due dates for debts paid in September...');

  // Plan Tigo: paid $75,000 on Sept 16 -> set due date to Oct 25, 2026
  const tigo = await prisma.debt.findFirst({ where: { cuenta: { nombre: 'Plan Tigo' } } });
  if (tigo) {
    await prisma.debt.update({
      where: { id: tigo.id },
      data: { fecha_limite_pago: new Date('2026-10-25T05:00:00.000Z') }
    });
    console.log('Updated Plan Tigo due date to Oct 25');
  }

  // Cadena (due day 15): paid $200,000 on Sept 16 -> set due date to Oct 15, 2026
  const cadenaSept = await prisma.debt.findFirst({ where: { cuenta: { nombre: 'Cadena' }, fecha_limite_pago: { lte: new Date('2026-09-20T00:00:00.000Z') } } });
  if (cadenaSept) {
    await prisma.debt.update({
      where: { id: cadenaSept.id },
      data: { fecha_limite_pago: new Date('2026-10-15T05:00:00.000Z') }
    });
    console.log('Updated Cadena due date to Oct 15');
  }

  // Solventa: paid $678,135 on Aug 19. If not paid in Sept, let's keep or check
  console.log('DB updates complete.');
}

fixPaidDebts()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
