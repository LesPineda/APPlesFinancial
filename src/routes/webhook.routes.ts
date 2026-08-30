import { Router } from 'express';
import { WebhookController } from '../controllers/webhook.controller';
import { validateBody } from '../middlewares/validation.middleware';

const router = Router();
const controller = new WebhookController();

router.post(
  '/transactions',
  validateBody(['cuenta_nombre', 'monto', 'tipo', 'fecha']),
  controller.handleTransactionWebhook.bind(controller)
);

export default router;
