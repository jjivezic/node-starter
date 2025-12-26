import authManager from './manager.js';
import { catchAsync, AppError } from '../../middleware/errorHandler.js';
import logger from '../../config/logger.js';

class AuthController {
  register = catchAsync(async (req, res) => {
    const { email, password, name } = req.body;
    const user = await authManager.register(email, password, name);
    logger.info(`New user registered: ${email}`);

    res.status(201).json({
      success: true,
      message: 'User registered successfully',
      data: user
    });
  });

  login = catchAsync(async (req, res) => {
    const { email, password } = req.body;

    const result = await authManager.login(email, password);
    logger.info(`User logged in: ${email}`);

    res.status(200).json({
      success: true,
      message: 'Login successful',
      data: result
    });
  });

  verifyToken = catchAsync(async (req, res) => {
    // Token already verified by middleware
    res.status(200).json({
      success: true,
      message: 'Token is valid',
      data: req.user
    });
  });

  refresh = catchAsync(async (req, res) => {
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

  logout = catchAsync(async (req, res) => {
    await authManager.logout(req.user.id);
    logger.info(`User logged out: ${req.user.email}`);

    res.status(200).json({
      success: true,
      message: 'Logged out successfully'
    });
  });
}

export default new AuthController();
