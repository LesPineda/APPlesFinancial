import { Request, Response, NextFunction } from 'express';
import { WebhookService } from '../services/webhook.service';

const webhookService = new WebhookService();

export class WebhookController {
  async handleTransactionWebhook(req: Request, res: Response, next: NextFunction): Promise<any> {
    try {
      const { cuenta_nombre, monto, tipo, fecha, descripcion } = req.body;
      
      const transaction = await webhookService.processTransactionWebhook({
        cuenta_nombre,
        monto,
        tipo,
        fecha,
        descripcion
      });

      return res.status(201).json({
        status: 'success',
        message: 'Transacción webhook procesada correctamente.',
        data: transaction
      });
    } catch (error) {
      return next(error);
    }
  }
}
