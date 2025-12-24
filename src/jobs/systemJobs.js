import { registerJob } from '../services/cronService.js';
import logger from '../config/logger.js';
import db from '../../database/models/index.js';

/**
 * System monitoring and health check jobs
 */

export const healthCheck = () => {
  registerJob(
    'health-check',
    '*/5 * * * *', // Every 5 minutes
    async () => {
      const checks = {
        database: false,
        memory: false,
        uptime: process.uptime()
      };

      try {
        // Check database connection
        await db.sequelize.authenticate();
        checks.database = true;
      } catch (error) {
        logger.error(`Health check failed - Database: ${error.message}`);
      }

      // Check memory usage
      const memUsage = process.memoryUsage();
      const memUsedMB = (memUsage.heapUsed / 1024 / 1024).toFixed(2);
      const memTotalMB = (memUsage.heapTotal / 1024 / 1024).toFixed(2);
      checks.memory = true;

      // Log health status
      if (checks.database && checks.memory) {
        logger.debug(`Health check OK - DB: connected, Memory: ${memUsedMB}/${memTotalMB}MB, Uptime: ${Math.floor(checks.uptime)}s`);
      } else {
        logger.warn('Health check WARNING - Some services are down', checks);
      }
    }
  );
};

export const generateAnalytics = () => {
  registerJob(
    'generate-analytics',
    '0 0 * * *', // Daily at midnight
    async () => {
      logger.info('Generating analytics...');
      // Analytics generation logic
    }
  );
};
