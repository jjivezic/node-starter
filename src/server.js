import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import swaggerUi from 'swagger-ui-express';
import routes from './routes/index.js';
import db from '../database/models/index.js';
import logger from './config/logger.js';
import morganMiddleware from './middleware/morganMiddleware.js';
import { errorHandler } from './middleware/errorHandler.js';
import swaggerSpec from './config/swagger.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE');
  res.header('Access-Control-Allow-Headers', 'Origin, Content-Type, X-Auth-Token');
  next();
});
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// HTTP request logger
app.use(morganMiddleware);

// Swagger documentation
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// API routes
app.use('/api', routes);

// 404 handler
app.use((req, res) => {
  logger.warn(`404 - Not Found - ${req.originalUrl} - ${req.method} - ${req.ip}`);
  res.status(404).json({
    success: false,
    message: 'Route not found'
  });
});

// Error handling middleware (must be last)
app.use(errorHandler);

// Start server
app.listen(PORT, async () => {
  logger.info(`Server is running on port ${PORT}`);
  logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
  
  // Sync database (only in development)
  if (process.env.NODE_ENV === 'development') {
    try {
      await db.sequelize.sync({ alter: false });
      logger.info('Database synchronized');
    } catch (error) {
      logger.error(`Database sync failed: ${error.message}`);
    }
  }
});

export default app;
