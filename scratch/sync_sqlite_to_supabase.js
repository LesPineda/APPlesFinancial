const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();

async function sync() {
  console.log('🚀 Iniciando sincronización de SQLite (Local) hacia Supabase PostgreSQL...');

  const dumpPath = path.join(__dirname, 'sqlite_clean_dump.json');
  if (!fs.existsSync(dumpPath)) {
    throw new Error('No se encontró scratch/sqlite_clean_dump.json');
  }

  const data = JSON.parse(fs.readFileSync(dumpPath, 'utf8'));
  const { cuentas, deudas, transacciones } = data;

  console.log(`📌 Datos a sincronizar:`);
  console.log(`   - Cuentas:       ${cuentas.length}`);
  console.log(`   - Deudas:        ${deudas.length}`);
  console.log(`   - Transacciones: ${transacciones.length}`);

  // 1. Limpiar transacciones y deudas actuales en Supabase
  console.log('🧹 Limpiando transacciones y deudas en Supabase...');
  await prisma.transaction.deleteMany();
  await prisma.debt.deleteMany();

  // 2. Sincronizar Cuentas (upsert una por una)
  console.log('💾 Sincronizando cuentas con sus saldos actualizados...');
  for (const c of cuentas) {
    await prisma.account.upsert({
      where: { id: c.id },
      update: {
        nombre: c.nombre,
        tipo: c.tipo,
        saldo_actual: c.saldo_actual,
        updatedAt: new Date(c.updatedAt)
      },
      create: {
        id: c.id,
        nombre: c.nombre,
        tipo: c.tipo,
        saldo_actual: c.saldo_actual,
        createdAt: new Date(c.createdAt),
        updatedAt: new Date(c.updatedAt)
      }
    });
  }
  console.log('✅ Cuentas sincronizadas.');

  // 3. Sincronizar Deudas usando createMany
  console.log('💳 Sincronizando deudas con saldos y cuotas amortizadas...');
  const debtData = deudas.map(d => ({
    id: d.id,
    cuenta_id: d.cuenta_id,
    saldo_total: d.saldo_total,
    tasa_interes_ea: d.tasa_interes_ea,
    pago_minimo: d.pago_minimo,
    fecha_corte: new Date(d.fecha_corte),
    fecha_limite_pago: new Date(d.fecha_limite_pago),
    cubierto_por: d.cubierto_por || null,
    createdAt: new Date(d.createdAt),
    updatedAt: new Date(d.updatedAt)
  }));
  await prisma.debt.createMany({ data: debtData });
  console.log('✅ Deudas sincronizadas.');

  // 4. Sincronizar Transacciones usando createMany
  console.log('📝 Sincronizando transacciones (incluyendo los últimos gastos del 28-sep)...');
  const txData = transacciones.map(t => ({
    id: t.id,
    cuenta_id: t.cuenta_id,
    tipo: t.tipo,
    monto: t.monto,
    fecha_transaccion: new Date(t.fecha_transaccion),
    descripcion: t.descripcion,
    kilometraje: t.kilometraje !== undefined ? t.kilometraje : null,
    createdAt: new Date(t.createdAt),
    updatedAt: new Date(t.updatedAt)
  }));
  await prisma.transaction.createMany({ data: txData });
  console.log('✅ Transacciones sincronizadas.');

  console.log('\n🎉 ¡Sincronización completada con éxito! Supabase está 100% igual al Local.');
}

sync()
  .catch((err) => {
    console.error('❌ Error durante la sincronización:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
