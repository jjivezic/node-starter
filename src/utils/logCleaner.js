import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Log cleanup utilities
 */

/**
 * Delete log files older than specified days
 * @param {number} maxAgeDays - Maximum age of logs in days
 * @returns {Object} - Cleanup statistics
 */
export const cleanLogsByAge = (maxAgeDays = 30) => {
  const logsDir = path.join(__dirname, '../../logs');
  const now = Date.now();
  const maxAgeMs = maxAgeDays * 24 * 60 * 60 * 1000;
  // const maxAgeMs = 1 * 60 * 60 * 1000; 1h for testing
  const stats = {
    deletedCount: 0,
    totalSize: 0,
    errors: []
  };

  try {
    if (!fs.existsSync(logsDir)) {
      return { ...stats, error: 'Logs directory does not exist' };
    }

    const files = fs.readdirSync(logsDir);
    console.log('Files in logs dir:', files);
    files.forEach((file) => {
      try {
        const filePath = path.join(logsDir, file);
        const fileStats = fs.statSync(filePath);

        if (!fileStats.isFile()) return;

        const fileAge = now - fileStats.mtimeMs;

        if (fileAge > maxAgeMs) {
          stats.totalSize += fileStats.size;
          fs.unlinkSync(filePath);
          stats.deletedCount += 1;
        }
      } catch (error) {
        stats.errors.push({ file, error: error.message });
      }
    });

    return stats;
  } catch (error) {
    return { ...stats, error: error.message };
  }
};

/**
 * Delete log files larger than specified size
 * @param {number} maxSizeMB - Maximum file size in MB
 * @returns {Object} - Cleanup statistics
 */
export const cleanLogsBySize = (maxSizeMB = 100) => {
  const logsDir = path.join(__dirname, '../../logs');
  const maxSizeBytes = maxSizeMB * 1024 * 1024;

  const stats = {
    deletedCount: 0,
    totalSize: 0,
    errors: []
  };

  try {
    if (!fs.existsSync(logsDir)) {
      return { ...stats, error: 'Logs directory does not exist' };
    }

    const files = fs.readdirSync(logsDir);

    files.forEach((file) => {
      try {
        const filePath = path.join(logsDir, file);
        const fileStats = fs.statSync(filePath);

        if (!fileStats.isFile()) return;

        if (fileStats.size > maxSizeBytes) {
          stats.totalSize += fileStats.size;
          fs.unlinkSync(filePath);
          stats.deletedCount += 1;
        }
      } catch (error) {
        stats.errors.push({ file, error: error.message });
      }
    });

    return stats;
  } catch (error) {
    return { ...stats, error: error.message };
  }
};

/**
 * Archive old logs to a compressed file
 * @param {number} maxAgeDays - Age threshold for archiving
 * @returns {Object} - Archive statistics
 */
export const archiveOldLogs = (maxAgeDays = 7) => {
  const logsDir = path.join(__dirname, '../../logs');
  const archiveDir = path.join(logsDir, 'archive');
  const now = Date.now();
  const maxAgeMs = maxAgeDays * 24 * 60 * 60 * 1000;

  try {
    // Create archive directory if it doesn't exist
    if (!fs.existsSync(archiveDir)) {
      fs.mkdirSync(archiveDir, { recursive: true });
    }

    const files = fs.readdirSync(logsDir);
    let archivedCount = 0;

    files.forEach((file) => {
      const filePath = path.join(logsDir, file);
      const fileStats = fs.statSync(filePath);

      if (!fileStats.isFile() || file.startsWith('archive')) return;

      const fileAge = now - fileStats.mtimeMs;

      if (fileAge > maxAgeMs) {
        const archivePath = path.join(archiveDir, file);
        fs.renameSync(filePath, archivePath);
        archivedCount += 1;
      }
    });

    return { success: true, archivedCount };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

/**
 * Get total size of logs directory
 * @returns {Object} - Directory size info
 */
export const getLogsDirSize = () => {
  const logsDir = path.join(__dirname, '../../logs');

  try {
    if (!fs.existsSync(logsDir)) {
      return { totalSize: 0, totalSizeMB: 0, fileCount: 0 };
    }

    const files = fs.readdirSync(logsDir);
    let totalSize = 0;
    let fileCount = 0;

    files.forEach((file) => {
      const filePath = path.join(logsDir, file);
      const stats = fs.statSync(filePath);

      if (stats.isFile()) {
        totalSize += stats.size;
        fileCount += 1;
      }
    });

    return {
      totalSize,
      totalSizeMB: (totalSize / (1024 * 1024)).toFixed(2),
      fileCount
    };
  } catch (error) {
    return { error: error.message };
  }
};
