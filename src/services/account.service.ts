import prisma from '../config/database';
import { Account, AccountType } from '@prisma/client';

export class AccountService {
  async getAll(): Promise<Account[]> {
    return prisma.account.findMany({
      orderBy: { createdAt: 'desc' }
    });
  }

  async getById(id: string): Promise<Account | null> {
    return prisma.account.findUnique({
      where: { id }
    });
  }

  async create(data: { nombre: string; tipo: AccountType; saldo_actual: number }): Promise<Account> {
    return prisma.account.create({
      data: {
        nombre: data.nombre,
        tipo: data.tipo,
        saldo_actual: data.saldo_actual
      }
    });
  }

  async update(id: string, data: { nombre?: string; tipo?: AccountType; saldo_actual?: number }): Promise<Account> {
    return prisma.account.update({
      where: { id },
      data
    });
  }

  async delete(id: string): Promise<Account> {
    return prisma.$transaction(async (tx) => {
      // Eliminar transacciones vinculadas
      await tx.transaction.deleteMany({
        where: { cuenta_id: id }
      });

      // Eliminar deudas vinculadas
      await tx.debt.deleteMany({
        where: { cuenta_id: id }
      });

      // Eliminar la cuenta
      return tx.account.delete({
        where: { id }
      });
    });
  }
}
