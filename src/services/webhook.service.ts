import prisma from '../config/database';
import { Transaction, TransactionType, AccountType } from '@prisma/client';
import { AppError } from '../middlewares/error.middleware';

export class WebhookService {
  async processTransactionWebhook(payload: {
    cuenta_nombre: string;
    monto: number;
    tipo: TransactionType;
    fecha: string;
    descripcion: string;
  }): Promise<Transaction> {
    const { cuenta_nombre, monto, tipo, fecha, descripcion } = payload;

    if (!cuenta_nombre || monto === undefined || !tipo || !fecha) {
      throw new AppError(400, 'Payload incompleto. Se requiere cuenta_nombre, monto, tipo y fecha.');
    }

    if (Number(monto) <= 0) {
      throw new AppError(400, 'El monto de la transacción debe ser mayor a cero.');
    }

    if (!['INGRESO', 'GASTO'].includes(tipo)) {
      throw new AppError(400, "Tipo de transacción inválido. Debe ser 'INGRESO' o 'GASTO'.");
    }

    const parsedDate = new Date(fecha);
    if (isNaN(parsedDate.getTime())) {
      throw new AppError(400, 'Formato de fecha inválido.');
    }

    // Usar una transacción atómica de base de datos
    return prisma.$transaction(async (tx) => {
      // Buscar la cuenta por nombre o crearla por defecto si no existe
      let account = await tx.account.findUnique({
        where: { nombre: cuenta_nombre }
      });

      if (!account) {
        account = await tx.account.create({
          data: {
            nombre: cuenta_nombre,
            tipo: AccountType.DEBITO,
            saldo_actual: 0.00
          }
        });
      }

      // Crear el registro de la transacción
      const transaction = await tx.transaction.create({
        data: {
          cuenta_id: account.id,
          tipo,
          monto: Number(monto),
          fecha_transaccion: parsedDate,
          descripcion: descripcion || `Transacción automatizada de Open Finance desde ${cuenta_nombre}`
        }
      });

      // Modificar de manera atómica el saldo de la cuenta
      const balanceChange = tipo === 'INGRESO' ? Number(monto) : -Number(monto);
      await tx.account.update({
        where: { id: account.id },
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
