import { Router } from 'express';
import { DebtController } from '../controllers/debt.controller';
import { validateBody } from '../middlewares/validation.middleware';

const router = Router();
const controller = new DebtController();

// Ruta de priorización (debe ir antes de /:id para no ser interceptada)
router.get('/prioritize', controller.prioritize.bind(controller));

router.get('/', controller.getAll.bind(controller));
router.get('/:id', controller.getById.bind(controller));
router.post(
  '/',
  validateBody(['cuenta_id', 'saldo_total', 'tasa_interes_ea', 'pago_minimo', 'fecha_corte', 'fecha_limite_pago']),
  controller.create.bind(controller)
);
router.put('/:id', controller.update.bind(controller));
router.delete('/:id', controller.delete.bind(controller));

export default router;
