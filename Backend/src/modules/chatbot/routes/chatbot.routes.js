import express from 'express';
import { processMessage, getSession } from '../controllers/chatbot.controller.js';

const router = express.Router();

router.post('/message', processMessage);
router.get('/session/:userId', getSession);

export default router;
