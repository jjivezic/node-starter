import metricsService from '../services/metricsService.js';

export const metricsMiddleware = (req, res, next) => {
  const startTime = Date.now();

  // Capture response finish event
  res.on('finish', () => {
    const responseTime = Date.now() - startTime;
    const { method, originalUrl: path } = req;
    const { statusCode } = res;

    // Record metrics
    metricsService.recordRequest(method, path, statusCode, responseTime);
  });

  next();
};
