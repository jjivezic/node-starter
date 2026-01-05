import express from 'express';
import * as vectorController from './controller.js';
import { validate } from '../../middleware/validate.js';
import { addDocumentsValidation, searchValidation, deleteDocumentsValidation } from './validation.js';
// import authMiddleware from '../../middleware/authMiddleware.js';

const router = express.Router();

// All routes require authentication
// router.use(authMiddleware);

// Vector operations
router.post(
  '/add',
  //  validate(addDocumentsValidation),
  vectorController.addDocuments
);

router.post(
  '/search',
  //  validate(searchValidation),
  vectorController.search
);

router.get('/stats', vectorController.getStats);

router.get('/all', vectorController.getAllDocuments);

router.post('/delete', validate(deleteDocumentsValidation), vectorController.deleteDocuments);

router.post('/reset', vectorController.reset);

export default router;
