import express from 'express';
import healthController from './controller.js';
import authMiddleware from '../../middleware/authMiddleware.js';

const router = express.Router();

/**
 * @swagger
 * /api/health:
 *   get:
 *     summary: Basic health check
 *     description: Returns basic server health status
 *     tags: [Health]
 *     responses:
 *       200:
 *         description: Server is healthy
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     status:
 *                       type: string
 *                       example: healthy
 *                     timestamp:
 *                       type: string
 *                       format: date-time
 *                     uptime:
 *                       type: number
 *                       example: 3600.5
 *                     environment:
 *                       type: string
 *                       example: development
 */
router.get('/', healthController.checkHealth);

/**
 * @swagger
 * /api/health/detailed:
 *   get:
 *     summary: Detailed health check
 *     description: Returns detailed health status including database and email service
 *     tags: [Health]
 *     responses:
 *       200:
 *         description: All services are healthy
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     status:
 *                       type: string
 *                       example: healthy
 *                     timestamp:
 *                       type: string
 *                       format: date-time
 *                     uptime:
 *                       type: number
 *                     environment:
 *                       type: string
 *                     services:
 *                       type: object
 *                       properties:
 *                         database:
 *                           type: object
 *                           properties:
 *                             healthy:
 *                               type: boolean
 *                             connected:
 *                               type: boolean
 *                         email:
 *                           type: object
 *                           properties:
 *                             healthy:
 *                               type: boolean
 *                             metrics:
 *                               type: object
 *                               properties:
 *                                 sent:
 *                                   type: number
 *                                 failed:
 *                                   type: number
 *                                 lastSuccess:
 *                                   type: string
 *                                 lastError:
 *                                   type: object
 *                         memory:
 *                           type: object
 *                           properties:
 *                             used:
 *                               type: number
 *                             total:
 *                               type: number
 *                             unit:
 *                               type: string
 *       503:
 *         description: One or more services are degraded
 */
router.get('/detailed', healthController.checkDetailedHealth);

/**
 * @swagger
 * /api/health/metrics:
 *   get:
 *     summary: Get performance metrics
 *     description: Returns detailed performance metrics including request stats, response times, errors, and system resources
 *     tags: [Health]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Performance metrics retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     uptime:
 *                       type: object
 *                       properties:
 *                         milliseconds:
 *                           type: number
 *                         seconds:
 *                           type: number
 *                         formatted:
 *                           type: string
 *                           example: "2d 5h 30m"
 *                     requests:
 *                       type: object
 *                       properties:
 *                         total:
 *                           type: number
 *                         byMethod:
 *                           type: object
 *                         byStatusCode:
 *                           type: object
 *                     performance:
 *                       type: object
 *                       properties:
 *                         avgResponseTime:
 *                           type: string
 *                           example: "125ms"
 *                         minResponseTime:
 *                           type: string
 *                         maxResponseTime:
 *                           type: string
 *                     errors:
 *                       type: object
 *                       properties:
 *                         total:
 *                           type: number
 *                         last5Minutes:
 *                           type: number
 *                         last60Minutes:
 *                           type: number
 *                         byStatusCode:
 *                           type: object
 *                         topErrorEndpoints:
 *                           type: array
 *                     topEndpoints:
 *                       type: array
 *                     memory:
 *                       type: object
 *                     system:
 *                       type: object
 *       401:
 *         description: Unauthorized - Authentication required
 */
router.get('/metrics', authMiddleware, healthController.getMetrics);

/**
 * @swagger
 * /api/health/metrics/reset:
 *   post:
 *     summary: Reset performance metrics
 *     description: Clears all collected metrics (admin only)
 *     tags: [Health]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Metrics reset successfully
 *       401:
 *         description: Unauthorized - Authentication required
 */
router.post('/metrics/reset', authMiddleware, healthController.resetMetrics);

export default router;
