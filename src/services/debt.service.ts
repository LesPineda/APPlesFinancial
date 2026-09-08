import prisma from '../config/database';
import { Debt } from '@prisma/client';
import { AppError } from '../middlewares/error.middleware';

export class DebtService {
  async getAll(): Promise<Debt[]> {
    return prisma.debt.findMany({
      include: { cuenta: true },
      orderBy: { createdAt: 'desc' }
    });
  }

  async getById(id: string): Promise<Debt | null> {
    return prisma.debt.findUnique({
      where: { id },
      include: { cuenta: true }
    });
  }

  async create(data: {
    cuenta_id: string;
    saldo_total: number;
    tasa_interes_ea: number;
    pago_minimo: number;
    fecha_corte: Date;
    fecha_limite_pago: Date;
    cubierto_por?: string | null;
  }): Promise<Debt> {
    const account = await prisma.account.findUnique({
      where: { id: data.cuenta_id }
    });
    if (!account) {
      throw new AppError(404, 'La cuenta asociada a la deuda no existe.');
    }

    return prisma.debt.create({
      data: {
        cuenta_id: data.cuenta_id,
        saldo_total: data.saldo_total,
        tasa_interes_ea: data.tasa_interes_ea,
        pago_minimo: data.pago_minimo,
        fecha_corte: data.fecha_corte,
        fecha_limite_pago: data.fecha_limite_pago,
        cubierto_por: data.cubierto_por || null
      }
    });
  }

  async update(
    id: string,
    data: {
      cuenta_id?: string;
      saldo_total?: number;
      tasa_interes_ea?: number;
      pago_minimo?: number;
      fecha_corte?: Date;
      fecha_limite_pago?: Date;
      cubierto_por?: string | null;
    }
  ): Promise<Debt> {
    const existing = await prisma.debt.findUnique({
      where: { id }
    });
    if (!existing) {
      throw new AppError(404, 'La deuda no existe.');
    }

    if (data.cuenta_id) {
      const account = await prisma.account.findUnique({
        where: { id: data.cuenta_id }
      });
      if (!account) {
        throw new AppError(404, 'La cuenta asociada a la deuda no existe.');
      }
    }

    return prisma.debt.update({
      where: { id },
      data
    });
  }

  async delete(id: string): Promise<Debt> {
    return prisma.debt.delete({
      where: { id }
    });
  }

  async prioritize(method: 'Avalancha' | 'Bola de Nieve'): Promise<Debt[]> {
    if (method === 'Avalancha') {
      return prisma.debt.findMany({
        where: { saldo_total: { gt: 0 } },
        include: { cuenta: true },
        orderBy: [
          { tasa_interes_ea: 'desc' },
          { saldo_total: 'asc' }
        ]
      });
    } else if (method === 'Bola de Nieve') {
      return prisma.debt.findMany({
        where: { saldo_total: { gt: 0 } },
        include: { cuenta: true },
        orderBy: [
          { saldo_total: 'asc' },
          { tasa_interes_ea: 'desc' }
        ]
      });
    } else {
      throw new AppError(400, "Método de priorización no válido. Use 'Avalancha' o 'Bola de Nieve'.");
    }
  }
}
