import { registerJob } from '../services/cronService.js';
import logger from '../config/logger.js';
import { cleanLogsByAge } from '../utils/logCleaner.js';

/**
 * Database maintenance jobs
 */

export const databaseBackup = () => {
  registerJob(
    'database-backup',
    '0 2 * * 0', // Every Sunday at 2 AM
    async () => {
      logger.info('Starting database backup...');
      // Backup logic here
    }
  );
};

export const cleanOldLogs = () => {
  registerJob(
    'clean-old-logs',
    '0 3 * * 1', // Every Monday at 3 AM
    async () => {
      const result = cleanLogsByAge(30);
      
      if (result.error) {
        logger.error(`Failed to clean logs: ${result.error}`);
        return;
      }
      
      const sizeMB = (result.totalSize / (1024 * 1024)).toFixed(2);
      logger.info(`Cleaned ${result.deletedCount} log files (${sizeMB} MB freed)`);
      
      if (result.errors.length > 0) {
        logger.warn(`Errors during cleanup: ${result.errors.length} files failed`);
      }
    }
  );
};
