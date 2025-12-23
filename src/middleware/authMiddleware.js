import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
import { AppError } from './errorHandler.js';
import { catchAsync } from './errorHandler.js';

dotenv.config();

const authMiddleware = catchAsync(async (req, res, next) => {
  // Get token from header
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new AppError('No token provided', 401);
  }

  // Extract token
  const token = authHeader.substring(7);

  // Verify token
  const decoded = jwt.verify(token, process.env.JWT_SECRET);
  
  // Attach user info to request
  req.user = decoded;
  
  next();
});

export default authMiddleware;
