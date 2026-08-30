import { Request, Response, NextFunction } from 'express';
import { AccountService } from '../services/account.service';
import { AppError } from '../middlewares/error.middleware';

const accountService = new AccountService();

export class AccountController {
  async getAll(req: Request, res: Response, next: NextFunction): Promise<any> {
    try {
      const accounts = await accountService.getAll();
      return res.json({ status: 'success', data: accounts });
    } catch (error) {
      return next(error);
    }
  }

  async getById(req: Request, res: Response, next: NextFunction): Promise<any> {
    try {
      const { id } = req.params as { id: string };
      const account = await accountService.getById(id);
      if (!account) {
        throw new AppError(404, 'Cuenta no encontrada');
      }
      return res.json({ status: 'success', data: account });
    } catch (error) {
      return next(error);
    }
  }

  async create(req: Request, res: Response, next: NextFunction): Promise<any> {
    try {
      const { nombre, tipo, saldo_actual } = req.body;
      
      // Basic business validation
      if (!['DEBITO', 'CREDITO', 'EFECTIVO', 'SERVICIO'].includes(tipo)) {
        throw new AppError(400, 'Tipo de cuenta inválido. Debe ser DEBITO, CREDITO, EFECTIVO o SERVICIO.');
      }

      const account = await accountService.create({
        nombre,
        tipo,
        saldo_actual: Number(saldo_actual)
      });
      return res.status(201).json({ status: 'success', data: account });
    } catch (error) {
      return next(error);
    }
  }

  async update(req: Request, res: Response, next: NextFunction): Promise<any> {
    try {
      const { id } = req.params as { id: string };
      const { nombre, tipo, saldo_actual } = req.body;
      
      const updateData: any = {};
      if (nombre !== undefined) updateData.nombre = nombre;
      if (tipo !== undefined) {
        if (!['DEBITO', 'CREDITO', 'EFECTIVO', 'SERVICIO'].includes(tipo)) {
          throw new AppError(400, 'Tipo de cuenta inválido.');
        }
        updateData.tipo = tipo;
      }
      if (saldo_actual !== undefined) updateData.saldo_actual = Number(saldo_actual);

      const account = await accountService.update(id, updateData);
      return res.json({ status: 'success', data: account });
    } catch (error) {
      return next(error);
    }
  }

  async delete(req: Request, res: Response, next: NextFunction): Promise<any> {
    try {
      const { id } = req.params as { id: string };
      await accountService.delete(id);
      return res.json({ status: 'success', message: 'Cuenta eliminada con éxito' });
    } catch (error) {
      return next(error);
    }
  }
}
