import prisma from '../config/database';
import { Transaction, TransactionType } from '@prisma/client';
import { AppError } from '../middlewares/error.middleware';

export class TransactionService {
  async getAll(): Promise<Transaction[]> {
    return prisma.transaction.findMany({
      orderBy: { fecha_transaccion: 'desc' }
    });
  }

  async getById(id: string): Promise<Transaction | null> {
    return prisma.transaction.findUnique({
      where: { id }
    });
  }

  async create(data: {
    cuenta_id: string;
    tipo: TransactionType;
    monto: number;
    fecha_transaccion: Date;
    descripcion: string;
  }): Promise<Transaction> {
    // Verificar que la cuenta exista
    const account = await prisma.account.findUnique({
      where: { id: data.cuenta_id }
    });
    if (!account) {
      throw new AppError(404, 'La cuenta asociada no existe.');
    }

    // Ejecutar en una transacción atómica para asegurar la integridad del saldo
    return prisma.$transaction(async (tx) => {
      const transaction = await tx.transaction.create({
        data: {
          cuenta_id: data.cuenta_id,
          tipo: data.tipo,
          monto: data.monto,
          fecha_transaccion: data.fecha_transaccion,
          descripcion: data.descripcion
        }
      });

      // Determinar la cuenta bancaria de dinero disponible de la cual se deducirá el dinero real
      let targetBankAccountId = data.cuenta_id;

      if (data.tipo === 'GASTO') {
        const selectedAccount = await tx.account.findUnique({ where: { id: data.cuenta_id } });
        const isDebtOrService = await tx.debt.findFirst({ where: { cuenta_id: data.cuenta_id } });

        // Si la cuenta seleccionada es de Deuda, Crédito o Servicio, el dinero real SALE de la cuenta bancaria líquida principal (Daviplata/Nequi)
        if (isDebtOrService || selectedAccount?.tipo === 'CREDITO' || selectedAccount?.tipo === 'SERVICIO') {
          const primaryBankAcc = await tx.account.findFirst({
            where: {
              tipo: { in: ['DEBITO', 'EFECTIVO'] },
              saldo_actual: { gt: 0 }
            },
            orderBy: { saldo_actual: 'desc' }
          });

          if (primaryBankAcc) {
            targetBankAccountId = primaryBankAcc.id;
          }
        }
      }

      // Modificar el saldo de la cuenta bancaria real
      const balanceChange = data.tipo === 'INGRESO' ? data.monto : -data.monto;
      await tx.account.update({
        where: { id: targetBankAccountId },
        data: {
          saldo_actual: {
            increment: balanceChange
          }
        }
      });

      // Si la cuenta tiene una deuda/servicio asociado y es un GASTO (pago de servicio/cuota), actualizar la deuda
      if (data.tipo === 'GASTO') {
        let associatedDebt = await tx.debt.findFirst({
          where: { cuenta_id: data.cuenta_id }
        });

        // Si el GASTO se realizó identificando la deuda por descripción
        if (!associatedDebt && data.descripcion) {
          const allDebts = await tx.debt.findMany({
            include: { cuenta: true }
          });
          associatedDebt = allDebts.find(d => 
            d.cuenta && data.descripcion.toLowerCase().includes(d.cuenta.nombre.toLowerCase())
          ) || null;
        }

        if (associatedDebt) {
          const currentSaldo = Number(associatedDebt.saldo_total);
          const pagoMin = Number(associatedDebt.pago_minimo);
          
          // Verificar si es un servicio público / consumo mensual (Gas, Agua, Luz, Internet)
          const debtAcc = await tx.account.findUnique({ where: { id: associatedDebt.cuenta_id } });
          const isService = Number(associatedDebt.tasa_interes_ea) === 0 || debtAcc?.tipo === 'SERVICIO' || currentSaldo <= pagoMin;

          // En servicios públicos variables, pagar la factura del mes (sea $20.600 o $25.000) liquida el mes completo
          const newSaldo = isService ? data.monto : Math.max(0, currentSaldo - data.monto);

          const currentLimit = new Date(associatedDebt.fecha_limite_pago);
          const newLimit = new Date(currentLimit);
          newLimit.setMonth(newLimit.getMonth() + 1);

          await tx.debt.update({
            where: { id: associatedDebt.id },
            data: {
              saldo_total: newSaldo,
              fecha_limite_pago: newLimit
            }
          });

          // Sync the associated account's saldo_actual to match the new debt balance
          if (debtAcc) {
            const isCredit = debtAcc.tipo === 'CREDITO';
            await tx.account.update({
              where: { id: debtAcc.id },
              data: {
                saldo_actual: isCredit ? -newSaldo : newSaldo
              }
            });
          }
        }
      }

      return transaction;
    });
  }

  async update(
    id: string,
    data: {
      cuenta_id?: string;
      tipo?: TransactionType;
      monto?: number;
      fecha_transaccion?: Date;
      descripcion?: string;
    }
  ): Promise<Transaction> {
    const existing = await prisma.transaction.findUnique({
      where: { id }
    });
    if (!existing) {
      throw new AppError(404, 'La transacción no existe.');
    }

    return prisma.$transaction(async (tx) => {
      // Revertir el impacto de la transacción anterior en la cuenta original
      const oldChange = existing.tipo === 'INGRESO' ? -Number(existing.monto) : Number(existing.monto);
      await tx.account.update({
        where: { id: existing.cuenta_id },
        data: {
          saldo_actual: {
            increment: oldChange
          }
        }
      });

      const targetCuentaId = data.cuenta_id ?? existing.cuenta_id;
      const targetTipo = data.tipo ?? existing.tipo;
      const targetMonto = data.monto ?? Number(existing.monto);

      // Verificar que la cuenta de destino exista
      const targetAccount = await tx.account.findUnique({
        where: { id: targetCuentaId }
      });
      if (!targetAccount) {
        throw new AppError(404, 'La cuenta de destino no existe.');
      }

      // Aplicar el nuevo impacto en la cuenta de destino
      const newChange = targetTipo === 'INGRESO' ? targetMonto : -targetMonto;
      await tx.account.update({
        where: { id: targetCuentaId },
        data: {
          saldo_actual: {
            increment: newChange
          }
        }
      });

      // Actualizar la transacción
      return tx.transaction.update({
        where: { id },
        data: {
          cuenta_id: data.cuenta_id,
          tipo: data.tipo,
          monto: data.monto,
          fecha_transaccion: data.fecha_transaccion,
          descripcion: data.descripcion
        }
      });
    });
  }

  async delete(id: string): Promise<Transaction> {
    const transaction = await prisma.transaction.findUnique({
      where: { id }
    });
    if (!transaction) {
      throw new AppError(404, 'La transacción no existe.');
    }

    return prisma.$transaction(async (tx) => {
      await tx.transaction.delete({
        where: { id }
      });

      // Revertir impacto de saldo
      const balanceChange = transaction.tipo === 'INGRESO' ? -Number(transaction.monto) : Number(transaction.monto);
      await tx.account.update({
        where: { id: transaction.cuenta_id },
        data: {
          saldo_actual: {
            increment: balanceChange
          }
        }
      });

      return transaction;
    });
  }
}
