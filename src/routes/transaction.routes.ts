import { Router } from 'express';
import { TransactionController } from '../controllers/transaction.controller';
import { validateBody } from '../middlewares/validation.middleware';

const router = Router();
const controller = new TransactionController();

router.get('/', controller.getAll.bind(controller));
router.get('/:id', controller.getById.bind(controller));
router.post('/', validateBody(['cuenta_id', 'tipo', 'monto', 'fecha_transaccion']), controller.create.bind(controller));
router.put('/:id', controller.update.bind(controller));
router.delete('/:id', controller.delete.bind(controller));

export default router;
