import logger from '../config/logger.js';

class MetricsService {
  constructor() {
    this.metrics = {
      requests: {
        total: 0,
        byMethod: {},
        byEndpoint: {},
        byStatusCode: {}
      },
      responseTimes: {
        total: 0,
        count: 0,
        min: Infinity,
        max: 0,
        byEndpoint: {}
      },
      errors: {
        total: 0,
        last24Hours: [],
        byStatusCode: {},
        byEndpoint: {}
      },
      startTime: Date.now()
    };

    // Clean up old errors every hour
    setInterval(() => this.cleanupOldErrors(), 60 * 60 * 1000);
  }

  recordRequest(method, path, statusCode, responseTime) {
    // Total requests
    this.metrics.requests.total++;

    // By method (GET, POST, etc.)
    this.metrics.requests.byMethod[method] = (this.metrics.requests.byMethod[method] || 0) + 1;

    // By endpoint
    const endpoint = this.normalizeEndpoint(path);
    if (!this.metrics.requests.byEndpoint[endpoint]) {
      this.metrics.requests.byEndpoint[endpoint] = {
        count: 0,
        methods: {}
      };
    }
    this.metrics.requests.byEndpoint[endpoint].count++;
    this.metrics.requests.byEndpoint[endpoint].methods[method] = 
      (this.metrics.requests.byEndpoint[endpoint].methods[method] || 0) + 1;

    // By status code
    this.metrics.requests.byStatusCode[statusCode] = 
      (this.metrics.requests.byStatusCode[statusCode] || 0) + 1;

    // Response times
    this.metrics.responseTimes.total += responseTime;
    this.metrics.responseTimes.count++;
    this.metrics.responseTimes.min = Math.min(this.metrics.responseTimes.min, responseTime);
    this.metrics.responseTimes.max = Math.max(this.metrics.responseTimes.max, responseTime);

    // Response time by endpoint
    if (!this.metrics.responseTimes.byEndpoint[endpoint]) {
      this.metrics.responseTimes.byEndpoint[endpoint] = {
        total: 0,
        count: 0,
        min: Infinity,
        max: 0
      };
    }
    const epMetrics = this.metrics.responseTimes.byEndpoint[endpoint];
    epMetrics.total += responseTime;
    epMetrics.count++;
    epMetrics.min = Math.min(epMetrics.min, responseTime);
    epMetrics.max = Math.max(epMetrics.max, responseTime);

    // Track errors (4xx and 5xx)
    if (statusCode >= 400) {
      this.recordError(method, endpoint, statusCode, responseTime);
    }
  }

  recordError(method, endpoint, statusCode, responseTime) {
    this.metrics.errors.total++;

    // Track in last 24 hours
    this.metrics.errors.last24Hours.push({
      timestamp: Date.now(),
      method,
      endpoint,
      statusCode,
      responseTime
    });

    // By status code
    this.metrics.errors.byStatusCode[statusCode] = 
      (this.metrics.errors.byStatusCode[statusCode] || 0) + 1;

    // By endpoint
    if (!this.metrics.errors.byEndpoint[endpoint]) {
      this.metrics.errors.byEndpoint[endpoint] = {
        count: 0,
        byStatusCode: {}
      };
    }
    this.metrics.errors.byEndpoint[endpoint].count++;
    this.metrics.errors.byEndpoint[endpoint].byStatusCode[statusCode] = 
      (this.metrics.errors.byEndpoint[endpoint].byStatusCode[statusCode] || 0) + 1;

    // Log if error rate is high
    this.checkErrorRate();
  }

  cleanupOldErrors() {
    const oneDayAgo = Date.now() - (24 * 60 * 60 * 1000);
    this.metrics.errors.last24Hours = this.metrics.errors.last24Hours.filter(
      error => error.timestamp > oneDayAgo
    );
  }

  checkErrorRate() {
    const recentErrors = this.getErrorsInLastMinutes(5);
    const recentRequests = this.metrics.requests.total;
    
    if (recentErrors.length > 20) {
      logger.warn(`High error rate detected: ${recentErrors.length} errors in last 5 minutes`);
    }
  }

  getErrorsInLastMinutes(minutes) {
    const cutoff = Date.now() - (minutes * 60 * 1000);
    return this.metrics.errors.last24Hours.filter(
      error => error.timestamp > cutoff
    );
  }

  normalizeEndpoint(path) {
    // Remove IDs and query params for grouping
    // /api/users/123 -> /api/users/:id
    // /api/products/456/reviews -> /api/products/:id/reviews
    return path
      .replace(/\/\d+/g, '/:id')
      .replace(/\?.*$/, '')
      .replace(/\/$/, '');
  }

  getMetrics() {
    const uptime = Date.now() - this.metrics.startTime;
    const avgResponseTime = this.metrics.responseTimes.count > 0
      ? Math.round(this.metrics.responseTimes.total / this.metrics.responseTimes.count)
      : 0;

    // Calculate top endpoints by request count
    const topEndpoints = Object.entries(this.metrics.requests.byEndpoint)
      .map(([endpoint, data]) => {
        const epResponseTime = this.metrics.responseTimes.byEndpoint[endpoint];
        return {
          endpoint,
          count: data.count,
          methods: data.methods,
          avgResponseTime: epResponseTime 
            ? Math.round(epResponseTime.total / epResponseTime.count) 
            : 0,
          minResponseTime: epResponseTime?.min !== Infinity ? epResponseTime.min : 0,
          maxResponseTime: epResponseTime?.max || 0
        };
      })
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    // Calculate recent error rate
    const last5MinErrors = this.getErrorsInLastMinutes(5);
    const last60MinErrors = this.getErrorsInLastMinutes(60);

    return {
      uptime: {
        milliseconds: uptime,
        seconds: Math.floor(uptime / 1000),
        formatted: this.formatUptime(uptime)
      },
      requests: {
        total: this.metrics.requests.total,
        byMethod: this.metrics.requests.byMethod,
        byStatusCode: this.metrics.requests.byStatusCode
      },
      performance: {
        avgResponseTime: `${avgResponseTime}ms`,
        minResponseTime: this.metrics.responseTimes.min !== Infinity 
          ? `${this.metrics.responseTimes.min}ms` 
          : '0ms',
        maxResponseTime: `${this.metrics.responseTimes.max}ms`
      },
      errors: {
        total: this.metrics.errors.total,
        last5Minutes: last5MinErrors.length,
        last60Minutes: last60MinErrors.length,
        byStatusCode: this.metrics.errors.byStatusCode,
        topErrorEndpoints: Object.entries(this.metrics.errors.byEndpoint)
          .map(([endpoint, data]) => ({
            endpoint,
            count: data.count,
            byStatusCode: data.byStatusCode
          }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 5)
      },
      topEndpoints,
      memory: {
        heapUsed: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
        heapTotal: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
        rss: Math.round(process.memoryUsage().rss / 1024 / 1024),
        unit: 'MB'
      },
      system: {
        nodeVersion: process.version,
        platform: process.platform,
        cpuUsage: process.cpuUsage()
      }
    };
  }

  formatUptime(ms) {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days}d ${hours % 24}h ${minutes % 60}m`;
    if (hours > 0) return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
    if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
    return `${seconds}s`;
  }

  reset() {
    this.metrics = {
      requests: {
        total: 0,
        byMethod: {},
        byEndpoint: {},
        byStatusCode: {}
      },
      responseTimes: {
        total: 0,
        count: 0,
        min: Infinity,
        max: 0,
        byEndpoint: {}
      },
      errors: {
        total: 0,
        last24Hours: [],
        byStatusCode: {},
        byEndpoint: {}
      },
      startTime: Date.now()
    };
    logger.info('Metrics reset');
  }
}

export default new MetricsService();
