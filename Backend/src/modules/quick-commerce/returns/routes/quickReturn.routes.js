import express from 'express';
import { authMiddleware } from '../../../../core/auth/auth.middleware.js';
import { requireRoles } from '../../../../core/roles/role.middleware.js';
import { verifyAccessToken } from '../../../../core/auth/token.util.js';
import * as returnController from '../controllers/quickReturn.controller.js';

// optional auth for users
const optionalAuth = (req, res, next) => {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ')
    ? authHeader.substring(7)
    : null;
  if (token) {
    try {
      const decoded = verifyAccessToken(token);
      req.user = { userId: decoded.userId, role: decoded.role };
    } catch (e) {
      // ignore guest
    }
  }
  next();
};

const router = express.Router();

const adminOrEmployee = [authMiddleware, requireRoles('ADMIN', 'EMPLOYEE')];
const sellerOnly = [authMiddleware, requireRoles('SELLER')];
const partnerOnly = [authMiddleware, requireRoles('DELIVERY_PARTNER')];

// ─── Settings Routes (Admin) ──────────────────────────────────────────────────
router.get('/admin/return-settings', ...adminOrEmployee, returnController.getSettings);
router.put('/admin/return-settings', ...adminOrEmployee, returnController.updateSettings);

// ─── Return Management Routes (Admin) ─────────────────────────────────────────
router.get('/admin/returns', ...adminOrEmployee, returnController.adminGetReturns);
router.get('/admin/returns/available-partners', ...adminOrEmployee, returnController.adminGetAvailablePartners);
router.get('/admin/returns/:id', ...adminOrEmployee, returnController.adminGetReturnById);
router.post('/admin/returns/:id/approve', ...adminOrEmployee, returnController.adminApproveReturn);
router.post('/admin/returns/:id/reject', ...adminOrEmployee, returnController.adminRejectReturn);
router.patch('/admin/returns/:id/assign-partner', ...adminOrEmployee, returnController.adminAssignPartner);
router.post('/admin/returns/:id/retrigger-refund', ...adminOrEmployee, returnController.adminRetriggerRefund);

// ─── Return User Routes ───────────────────────────────────────────────────────
router.get('/returns', optionalAuth, returnController.userGetReturns);
router.post('/returns', optionalAuth, returnController.userCreateReturn);
router.get('/returns/eligibility/:orderId', optionalAuth, returnController.checkEligibility);

// ─── Return Delivery Partner Routes ──────────────────────────────────────────
router.get('/delivery/return-pickups', ...partnerOnly, returnController.partnerGetPickups);
router.post('/delivery/return-pickups/:id/verify-otp', ...partnerOnly, returnController.partnerVerifyOtp);
router.post('/delivery/return-pickups/:id/confirm-pickup', ...partnerOnly, returnController.partnerConfirmPickup);
router.post('/delivery/return-pickups/:id/deliver-to-seller', ...partnerOnly, returnController.partnerMarkDeliveredToSeller);

// ─── Return Seller Routes ─────────────────────────────────────────────────────
router.get('/seller/return-orders', ...sellerOnly, returnController.sellerGetReturns);
router.post('/seller/return-orders/:id/confirm-receipt', ...sellerOnly, returnController.sellerConfirmReceipt);

export default router;
