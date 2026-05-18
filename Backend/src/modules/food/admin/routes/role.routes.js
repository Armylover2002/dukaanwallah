import express from 'express';
import * as roleController from '../controllers/role.controller.js';

const router = express.Router();

router.get('/', roleController.getRoles);
router.get('/:id', roleController.getRoleById);
router.post('/', roleController.createRole);
router.patch('/:id', roleController.updateRole);
router.patch('/:id/toggle', roleController.toggleRoleStatus);

export default router;
