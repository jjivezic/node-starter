import authManager from './manager.js';
import { catchAsync, AppError } from '../../middleware/errorHandler.js';
import logger from '../../config/logger.js';

class AuthController {
  register = catchAsync(async (req, res, next) => {
    const { email, password, name } = req.body;

    // Validate input
    if (!email || !password || !name) {
      logger.warn(`Registration attempt failed: Missing fields from ${req.ip},email:${email}`);
      throw new AppError('Email, password, and name are required', 400);
    }

    const user = await authManager.register(email, password, name);
    logger.info(`New user registered: ${email} from ${req.ip}`);

    res.status(201).json({
      success: true,
      message: 'User registered successfully',
      data: user
    });
  });

  login = catchAsync(async (req, res, next) => {
    const { email, password } = req.body;

    // Validate input
    if (!email || !password) {
      logger.warn(`Login attempt failed: Missing credentials from ${req.ip},email:${email}`);
      throw new AppError('Email and password are required', 400);
    }

    const result = await authManager.login(email, password);
    logger.info(`User logged in: ${email} from ${req.ip}`);

    res.status(200).json({
      success: true,
      message: 'Login successful',
      data: result
    });
  });

  verifyToken = catchAsync(async (req, res, next) => {
    // Token already verified by middleware
    res.status(200).json({
      success: true,
      message: 'Token is valid',
      data: req.user
    });
  });

  refresh = catchAsync(async (req, res, next) => {
    const refreshToken = req.headers['x-refresh-token'] || req.body.refreshToken;

    if (!refreshToken) {
      throw new AppError('Refresh token is required', 400);
    }

    const result = await authManager.refreshAccessToken(refreshToken);
    logger.info(`Access token refreshed for user: ${result.user.email}`);

    res.status(200).json({
      success: true,
      message: 'Token refreshed successfully',
      data: result
    });
  });

  logout = catchAsync(async (req, res, next) => {
    await authManager.logout(req.user.id);
    logger.info(`User logged out: ${req.user.email}`);

    res.status(200).json({
      success: true,
      message: 'Logged out successfully'
    });
  });
}

export default new AuthController();
