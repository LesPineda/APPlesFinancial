import { Request, Response, NextFunction } from 'express';
import { TransactionService } from '../services/transaction.service';
import { AppError } from '../middlewares/error.middleware';

const transactionService = new TransactionService();

export class TransactionController {
  async getAll(req: Request, res: Response, next: NextFunction): Promise<any> {
    try {
      const transactions = await transactionService.getAll();
      return res.json({ status: 'success', data: transactions });
    } catch (error) {
      return next(error);
    }
  }

  async getById(req: Request, res: Response, next: NextFunction): Promise<any> {
    try {
      const { id } = req.params as { id: string };
      const transaction = await transactionService.getById(id);
      if (!transaction) {
        throw new AppError(404, 'Transacción no encontrada');
      }
      return res.json({ status: 'success', data: transaction });
    } catch (error) {
      return next(error);
    }
  }

  async create(req: Request, res: Response, next: NextFunction): Promise<any> {
    try {
      const { cuenta_id, tipo, monto, fecha_transaccion, descripcion } = req.body;

      if (!['INGRESO', 'GASTO'].includes(tipo)) {
        throw new AppError(400, 'Tipo de transacción inválido. Debe ser INGRESO o GASTO.');
      }

      if (Number(monto) <= 0) {
        throw new AppError(400, 'El monto debe ser mayor a cero.');
      }

      const parsedDate = new Date(fecha_transaccion);
      if (isNaN(parsedDate.getTime())) {
        throw new AppError(400, 'Fecha de transacción inválida.');
      }

      const transaction = await transactionService.create({
        cuenta_id,
        tipo,
        monto: Number(monto),
        fecha_transaccion: parsedDate,
        descripcion
      });

      return res.status(201).json({ status: 'success', data: transaction });
    } catch (error) {
      return next(error);
    }
  }

  async update(req: Request, res: Response, next: NextFunction): Promise<any> {
    try {
      const { id } = req.params as { id: string };
      const { cuenta_id, tipo, monto, fecha_transaccion, descripcion } = req.body;

      const updateData: any = {};
      if (cuenta_id !== undefined) updateData.cuenta_id = cuenta_id;
      if (tipo !== undefined) {
        if (!['INGRESO', 'GASTO'].includes(tipo)) {
          throw new AppError(400, 'Tipo de transacción inválido.');
        }
        updateData.tipo = tipo;
      }
      if (monto !== undefined) {
        if (Number(monto) <= 0) {
          throw new AppError(400, 'El monto debe ser mayor a cero.');
        }
        updateData.monto = Number(monto);
      }
      if (fecha_transaccion !== undefined) {
        const parsedDate = new Date(fecha_transaccion);
        if (isNaN(parsedDate.getTime())) {
          throw new AppError(400, 'Fecha de transacción inválida.');
        }
        updateData.fecha_transaccion = parsedDate;
      }
      if (descripcion !== undefined) updateData.descripcion = descripcion;

      const transaction = await transactionService.update(id, updateData);
      return res.json({ status: 'success', data: transaction });
    } catch (error) {
      return next(error);
    }
  }

  async delete(req: Request, res: Response, next: NextFunction): Promise<any> {
    try {
      const { id } = req.params as { id: string };
      await transactionService.delete(id);
      return res.json({ status: 'success', message: 'Transacción eliminada y saldo actualizado con éxito.' });
    } catch (error) {
      return next(error);
    }
  }
}
