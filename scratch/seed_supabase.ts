import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

dotenv.config();

const prisma = new PrismaClient();

async function seed() {
  console.log('🚀 Importando datos desde dump.json a Supabase PostgreSQL...');

  const dumpPath = path.resolve(__dirname, 'dump.json');
  if (!fs.existsSync(dumpPath)) {
    console.error('❌ Archivo dump.json no encontrado.');
    return;
  }

  const rawData = fs.readFileSync(dumpPath, 'utf-8');
  const data = JSON.parse(rawData);

  try {
    // 1. Cuentas
    console.log(`📌 Importando ${data.cuentas.length} cuentas...`);
    for (const c of data.cuentas) {
      await prisma.account.upsert({
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
          createdAt: new Date(c.createdAt),
          updatedAt: new Date(c.updatedAt)
        }
      });
    }
    console.log('✅ Cuentas creadas en Supabase.');

    // 2. Deudas
    console.log(`📌 Importando ${data.deudas.length} deudas...`);
    for (const d of data.deudas) {
      await prisma.debt.upsert({
        where: { id: d.id },
        update: {
          saldo_total: d.saldo_total,
          tasa_interes_ea: d.tasa_interes_ea,
          pago_minimo: d.pago_minimo,
          fecha_corte: new Date(d.fecha_corte),
          fecha_limite_pago: new Date(d.fecha_limite_pago)
        },
        create: {
          id: d.id,
          cuenta_id: d.cuenta_id,
          saldo_total: d.saldo_total,
          tasa_interes_ea: d.tasa_interes_ea,
          pago_minimo: d.pago_minimo,
          fecha_corte: new Date(d.fecha_corte),
          fecha_limite_pago: new Date(d.fecha_limite_pago),
          createdAt: new Date(d.createdAt),
          updatedAt: new Date(d.updatedAt)
        }
      });
    }
    console.log('✅ Deudas creadas en Supabase.');

    // 3. Transacciones
    console.log(`📌 Importando ${data.transacciones.length} transacciones...`);
    for (const t of data.transacciones) {
      await prisma.transaction.upsert({
        where: { id: t.id },
        update: {
          monto: t.monto,
          tipo: t.tipo,
          descripcion: t.descripcion,
          fecha_transaccion: new Date(t.fecha_transaccion)
        },
        create: {
          id: t.id,
          cuenta_id: t.cuenta_id,
          tipo: t.tipo,
          monto: t.monto,
          fecha_transaccion: new Date(t.fecha_transaccion),
          descripcion: t.descripcion,
          createdAt: new Date(t.createdAt),
          updatedAt: new Date(t.updatedAt)
        }
      });
    }
    console.log('🎉 ¡TODOS LOS DATOS FUERON MIGRADOS EXITOSAMENTE A SUPABASE POSTGRESQL!');
  } catch (error) {
    console.error('❌ Error guardando datos en Supabase:', error);
  } finally {
    await prisma.$disconnect();
  }
}

seed();
