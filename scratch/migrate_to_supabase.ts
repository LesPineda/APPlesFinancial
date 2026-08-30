import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';

dotenv.config();

const sqlitePrisma = new PrismaClient({
  datasources: {
    db: {
      url: 'file:../prisma/dev.db'
    }
  }
});

const supabasePrisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL
    }
  }
});

async function migrate() {
  console.log('🔄 Iniciando migración directa de datos SQLite a Supabase PostgreSQL...');

  try {
    const cuentas = await sqlitePrisma.account.findMany();
    console.log(`📌 Encontradas ${cuentas.length} cuentas en SQLite local.`);

    for (const c of cuentas) {
      await supabasePrisma.account.upsert({
        where: { id: c.id },
        update: {
          nombre: c.nombre,
          tipo: c.tipo,
          saldo_actual: c.saldo_actual
        },
        create: {
          id: c.id,
          nombre: c.nombre,
          tipo: c.tipo,
          saldo_actual: c.saldo_actual,
          createdAt: c.createdAt,
          updatedAt: c.updatedAt
        }
      });
    }
    console.log('✅ Cuentas migradas a Supabase.');

    const deudas = await sqlitePrisma.debt.findMany();
    console.log(`📌 Encontradas ${deudas.length} deudas en SQLite local.`);

    for (const d of deudas) {
      await supabasePrisma.debt.upsert({
        where: { id: d.id },
        update: {
          saldo_total: d.saldo_total,
          tasa_interes_ea: d.tasa_interes_ea,
          pago_minimo: d.pago_minimo,
          fecha_corte: d.fecha_corte,
          fecha_limite_pago: d.fecha_limite_pago
        },
        create: {
          id: d.id,
          cuenta_id: d.cuenta_id,
          saldo_total: d.saldo_total,
          tasa_interes_ea: d.tasa_interes_ea,
          pago_minimo: d.pago_minimo,
          fecha_corte: d.fecha_corte,
          fecha_limite_pago: d.fecha_limite_pago,
          createdAt: d.createdAt,
          updatedAt: d.updatedAt
        }
      });
    }
    console.log('✅ Deudas migradas a Supabase.');

    const transacciones = await sqlitePrisma.transaction.findMany();
    console.log(`📌 Encontradas ${transacciones.length} transacciones en SQLite local.`);

    for (const t of transacciones) {
      await supabasePrisma.transaction.upsert({
        where: { id: t.id },
        update: {
          monto: t.monto,
          tipo: t.tipo,
          descripcion: t.descripcion,
          fecha_transaccion: t.fecha_transaccion
        },
        create: {
          id: t.id,
          cuenta_id: t.cuenta_id,
          tipo: t.tipo,
          monto: t.monto,
          fecha_transaccion: t.fecha_transaccion,
          descripcion: t.descripcion,
          createdAt: t.createdAt,
          updatedAt: t.updatedAt
        }
      });
    }
    console.log('🎉 ¡Migración completa! Todos los datos están sincronizados en Supabase PostgreSQL.');
  } catch (error) {
    console.error('❌ Error migrando datos:', error);
  } finally {
    await sqlitePrisma.$disconnect();
    await supabasePrisma.$disconnect();
  }
}

migrate();
