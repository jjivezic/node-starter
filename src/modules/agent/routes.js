import express from 'express';
import * as agentController from './controller.js';
// import authMiddleware from '../../middleware/authMiddleware.js';

const router = express.Router();

// Agent routes
router.post('/task', agentController.executeTask);

export default router;
