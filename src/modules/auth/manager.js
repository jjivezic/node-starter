import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import db from '../../../database/models/index.js';
import dotenv from 'dotenv';
import { AppError, COMMON_ERRORS } from '../../middleware/errorHandler.js';
import logger from '../../config/logger.js';

const { User } = db;
dotenv.config();

class AuthManager {
  async register(email, password, name) {
    // Check if user already exists
    const existingUser = await User.findOne({ where: { email } });

    if (existingUser) {
      logger.warn(`Registration failed: User already exists - ${email}`);
      throw new AppError('User already exists', 409);
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create user
    const user = await User.create({
      email,
      password: hashedPassword,
      name
    });

    return {
      id: user.id,
      email: user.email,
      name: user.name
    };
  }
  async login(email, password) {
    // Get user by email
    const user = await User.findOne({ where: { email } });

    if (!user) {
      logger.warn(`Login failed: User not found - email: ${email}`);
      throw new AppError('Invalid credentials', 401);
    }

    // Verify password
    const isValidPassword = await bcrypt.compare(password, user.password);

    if (!isValidPassword) {
      logger.warn(`Login failed: Invalid password - ${email}`);
      throw new AppError('Invalid credentials', 401);
    }

    // Generate access token (short-lived: 15 minutes)
    const accessToken = jwt.sign(
      { 
        id: user.id, 
        email: user.email 
      },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '15m' }
    );

    // Generate refresh token (long-lived: 7 days)
    const refreshToken = jwt.sign(
      { 
        id: user.id, 
        email: user.email,
        type: 'refresh'
      },
      process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d' }
    );

    // Save refresh token to database
    await user.update({ refresh_token: refreshToken });

    return {
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        email: user.email,
        name: user.name
      }
    };
  }

  async refreshAccessToken(refreshToken) {
    try {
      // Verify refresh token
      const decoded = jwt.verify(
        refreshToken, 
        process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET
      );

      // Check if it's a refresh token
      if (decoded.type !== 'refresh') {
        throw new AppError('Invalid token type', 401);
      }

      // Find user and verify refresh token matches
      const user = await User.findByPk(decoded.id);
      
      if (!user || user.refresh_token !== refreshToken) {
        throw new AppError('Invalid refresh token', 401);
      }

      // Generate new access token
      const newAccessToken = jwt.sign(
        { 
          id: user.id, 
          email: user.email 
        },
        process.env.JWT_SECRET,
        { expiresIn: process.env.JWT_EXPIRES_IN || '15m' }
      );

      return {
        accessToken: newAccessToken,
        user: {
          id: user.id,
          email: user.email,
          name: user.name
        }
      };
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw new AppError('Invalid or expired refresh token', 401);
    }
  }

  async logout(userId) {
    // Remove refresh token from database
    await User.update(
      { refresh_token: null },
      { where: { id: userId } }
    );
    
    return { success: true };
  }

  async verifyToken(token) {
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      return decoded;
    } catch (error) {
      throw new AppError('Invalid token', 401);
    }
  }
}

export default new AuthManager();
