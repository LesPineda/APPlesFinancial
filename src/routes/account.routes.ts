import { Router } from 'express';
import { AccountController } from '../controllers/account.controller';
import { validateBody } from '../middlewares/validation.middleware';

const router = Router();
const controller = new AccountController();

router.get('/', controller.getAll.bind(controller));
router.get('/:id', controller.getById.bind(controller));
router.post('/', validateBody(['nombre', 'tipo', 'saldo_actual']), controller.create.bind(controller));
router.put('/:id', controller.update.bind(controller));
router.delete('/:id', controller.delete.bind(controller));

export default router;
