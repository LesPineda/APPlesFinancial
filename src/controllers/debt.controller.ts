import { Request, Response, NextFunction } from 'express';
import { DebtService } from '../services/debt.service';
import { AppError } from '../middlewares/error.middleware';

const debtService = new DebtService();

export class DebtController {
  async getAll(req: Request, res: Response, next: NextFunction): Promise<any> {
    try {
      const debts = await debtService.getAll();
      return res.json({ status: 'success', data: debts });
    } catch (error) {
      return next(error);
    }
  }

  async getById(req: Request, res: Response, next: NextFunction): Promise<any> {
    try {
      const { id } = req.params as { id: string };
      const debt = await debtService.getById(id);
      if (!debt) {
        throw new AppError(404, 'Deuda no encontrada');
      }
      return res.json({ status: 'success', data: debt });
    } catch (error) {
      return next(error);
    }
  }

  async create(req: Request, res: Response, next: NextFunction): Promise<any> {
    try {
      const { cuenta_id, saldo_total, tasa_interes_ea, pago_minimo, fecha_corte, fecha_limite_pago, cubierto_por } = req.body;

      if (Number(saldo_total) < 0 || Number(tasa_interes_ea) < 0 || Number(pago_minimo) < 0) {
        throw new AppError(400, 'Los montos y tasas deben ser mayores o iguales a cero.');
      }

      const corteDate = new Date(fecha_corte);
      const limiteDate = new Date(fecha_limite_pago);

      if (isNaN(corteDate.getTime()) || isNaN(limiteDate.getTime())) {
        throw new AppError(400, 'Las fechas de corte o límite de pago no son válidas.');
      }

      const debt = await debtService.create({
        cuenta_id,
        saldo_total: Number(saldo_total),
        tasa_interes_ea: Number(tasa_interes_ea),
        pago_minimo: Number(pago_minimo),
        fecha_corte: corteDate,
        fecha_limite_pago: limiteDate,
        cubierto_por: cubierto_por !== undefined ? String(cubierto_por) : null
      });

      return res.status(201).json({ status: 'success', data: debt });
    } catch (error) {
      return next(error);
    }
  }

  async update(req: Request, res: Response, next: NextFunction): Promise<any> {
    try {
      const { id } = req.params as { id: string };
      const { cuenta_id, saldo_total, tasa_interes_ea, pago_minimo, fecha_corte, fecha_limite_pago, cubierto_por } = req.body;

      const updateData: any = {};
      if (cuenta_id !== undefined) updateData.cuenta_id = cuenta_id;
      if (cubierto_por !== undefined) updateData.cubierto_por = cubierto_por ? String(cubierto_por) : null;
      if (saldo_total !== undefined) {
        if (Number(saldo_total) < 0) throw new AppError(400, 'El saldo total no puede ser negativo.');
        updateData.saldo_total = Number(saldo_total);
      }
      if (tasa_interes_ea !== undefined) {
        if (Number(tasa_interes_ea) < 0) throw new AppError(400, 'La tasa de interés no puede ser negativa.');
        updateData.tasa_interes_ea = Number(tasa_interes_ea);
      }
      if (pago_minimo !== undefined) {
        if (Number(pago_minimo) < 0) throw new AppError(400, 'El pago mínimo no puede ser negativo.');
        updateData.pago_minimo = Number(pago_minimo);
      }
      if (fecha_corte !== undefined) {
        const corteDate = new Date(fecha_corte);
        if (isNaN(corteDate.getTime())) throw new AppError(400, 'Fecha de corte inválida.');
        updateData.fecha_corte = corteDate;
      }
      if (fecha_limite_pago !== undefined) {
        const limiteDate = new Date(fecha_limite_pago);
        if (isNaN(limiteDate.getTime())) throw new AppError(400, 'Fecha límite de pago inválida.');
        updateData.fecha_limite_pago = limiteDate;
      }

      const debt = await debtService.update(id, updateData);
      return res.json({ status: 'success', data: debt });
    } catch (error) {
      return next(error);
    }
  }

  async delete(req: Request, res: Response, next: NextFunction): Promise<any> {
    try {
      const { id } = req.params as { id: string };
      await debtService.delete(id);
      return res.json({ status: 'success', message: 'Deuda eliminada con éxito.' });
    } catch (error) {
      return next(error);
    }
  }

  async prioritize(req: Request, res: Response, next: NextFunction): Promise<any> {
    try {
      const { method } = req.query as { method: string };

      if (!method || (method !== 'Avalancha' && method !== 'Bola de Nieve')) {
        throw new AppError(400, "Debe especificar un método de priorización válido por query param ('Avalancha' o 'Bola de Nieve'). Ejemplo: ?method=Avalancha");
      }

      const prioritizedDebts = await debtService.prioritize(method);
      return res.json({ status: 'success', method, data: prioritizedDebts });
    } catch (error) {
      return next(error);
    }
  }
}
