import express from 'express';
import authRoutes from '../modules/auth/routes.js';
import userRoutes from '../modules/users/routes.js';
import productRoutes from '../modules/product/routes.js';
import healthRoutes from '../modules/health/routes.js';

const router = express.Router();

// Mount routes
router.use('/auth', authRoutes);
router.use('/users', userRoutes);
router.use('/products', productRoutes);
router.use('/health', healthRoutes);

export default router;
