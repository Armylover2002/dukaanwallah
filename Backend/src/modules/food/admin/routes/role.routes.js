import express from 'express';
import * as roleController from '../controllers/role.controller.js';
import { checkPermission } from '../../../../core/auth/auth.middleware.js';

const router = express.Router();

router.get('/', checkPermission('food::staff_management::roles', 'view'), roleController.getRoles);
router.get('/:id', checkPermission('food::staff_management::roles', 'view'), roleController.getRoleById);
router.post('/', checkPermission('food::staff_management::roles', 'create'), roleController.createRole);
router.patch('/:id', checkPermission('food::staff_management::roles', 'edit'), roleController.updateRole);
router.patch('/:id/toggle', checkPermission('food::staff_management::roles', 'edit'), roleController.toggleRoleStatus);

export default router;

