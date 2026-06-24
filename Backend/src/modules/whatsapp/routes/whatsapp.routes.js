import express from 'express';
import { getSettings, updateSettings, sendTestMessage } from '../controllers/whatsappSettings.controller.js';

const router = express.Router();

router.get('/settings', getSettings);
router.put('/settings', updateSettings);
router.post('/test-message', sendTestMessage);

export default router;
