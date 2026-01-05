import express from 'express';
import * as aiController from './controller.js';
import { validate } from '../../middleware/validate.js';
import { chatValidation, chatWithHistoryValidation } from './validation.js';
import authMiddleware from '../../middleware/authMiddleware.js';

const router = express.Router();

// Public route - get examples (no auth required)
router.get('/examples', aiController.getExamples);

// Protected routes - require authentication
router.post(
  '/chat',
  // authMiddleware,
  validate(chatValidation),
  aiController.chat
);

router.post('/chat-history', authMiddleware, validate(chatWithHistoryValidation), aiController.chatWithHistory);

export default router;
