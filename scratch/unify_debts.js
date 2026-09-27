const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('🚀 Iniciando unificación de deudas...');

  await prisma.$transaction(async (tx) => {
    const debtsToCancel = ['Credito libre 38', 'Credito libre 16', 'Tarjeta Golds'];
    
    for (const name of debtsToCancel) {
      const acc = await tx.account.findUnique({ where: { nombre: name } });
      if (acc) {
        await tx.account.update({
          where: { id: acc.id },
          data: { saldo_actual: 0 }
        });
        await tx.debt.updateMany({
          where: { cuenta_id: acc.id },
          data: { saldo_total: 0, pago_minimo: 0 }
        });
        console.log(`✅ Cancelada cuenta y deuda: "${name}" ($0 saldo)`);
      }
    }

    // Crear la nueva cuenta Crédito Unificado
    const newAcc = await tx.account.create({
      data: {
        nombre: 'Crédito Unificado',
        tipo: 'CREDITO',
        saldo_actual: -62438942
      }
    });
    console.log(`✅ Creada cuenta "Crédito Unificado" (ID: ${newAcc.id})`);

    // Crear la nueva deuda unificada
    const newDebt = await tx.debt.create({
      data: {
        cuenta_id: newAcc.id,
        saldo_total: 62438942,
        tasa_interes_ea: 13.17,
        pago_minimo: 1323191,
        fecha_corte: new Date('2026-10-15T00:00:00.000Z'),
        fecha_limite_pago: new Date('2026-10-30T00:00:00.000Z')
      }
    });
    console.log(`✅ Creada nueva deuda unificada (ID: ${newDebt.id})`);
  });

  console.log('🎉 Unificación aplicada con éxito en la base de datos.');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
