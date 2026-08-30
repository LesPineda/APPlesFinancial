import { Router } from 'express';
import accountRoutes from './account.routes';
import transactionRoutes from './transaction.routes';
import debtRoutes from './debt.routes';
import webhookRoutes from './webhook.routes';

const router = Router();

router.use('/accounts', accountRoutes);
router.use('/transactions', transactionRoutes);
router.use('/debts', debtRoutes);
router.use('/webhooks', webhookRoutes);

export default router;
