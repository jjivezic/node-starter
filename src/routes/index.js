import express from 'express';
import authRoutes from '../modules/auth/routes.js';
import userRoutes from '../modules/users/routes.js';
import productRoutes from '../modules/product/routes.js';

const router = express.Router();

// Mount routes
router.use('/auth', authRoutes);
router.use('/users', userRoutes);
router.use('/products', productRoutes);

// Health check route
router.get('/health', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Server is running'
  });
});

export default router;
