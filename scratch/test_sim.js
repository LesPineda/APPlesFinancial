const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const debts = await prisma.debt.findMany({ include: { cuenta: true } });
  let simDebts = debts
    .filter(d => Number(d.saldo_total) > 0 && (!d.cubierto_por || d.cubierto_por.trim() === ''))
    .map(d => ({
      id: d.id,
      nombre: d.cuenta ? d.cuenta.nombre : 'Deuda',
      saldo: Number(d.saldo_total),
      pagoMin: Number(d.pago_minimo),
      tasaEa: Number(d.tasa_interes_ea)
    }));

  simDebts.sort((a, b) => a.saldo - b.saldo);
  console.log('Debts in simulation order:');
  simDebts.forEach(d => {
    console.log(`- ${d.nombre}: Saldo $${d.saldo.toLocaleString('es-CO')}, Cuota $${d.pagoMin.toLocaleString('es-CO')}`);
  });
}

main().finally(() => prisma.$disconnect());
