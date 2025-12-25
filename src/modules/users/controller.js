import userManager from './manager.js';
import { catchAsync } from '../../middleware/errorHandler.js';
import logger from '../../config/logger.js';

class UserController {
  getAllUsersPaginated = catchAsync(async (req, res) => {
    const { items, total } = await userManager.getAllUsersPaginated(
      req.filters || {},
      req.sort || {},
      req.pagination || {}
    );

    res.status(200).json({
      success: true,
      data: items,
      total
    });
  });

  getAllUsers = catchAsync(async (req, res) => {
    const users = await userManager.getAllUsers(
      req.filters || {},
      req.sort || {}
    );

    res.status(200).json({
      success: true,
      data: users
    });
  });

  getUserById = catchAsync(async (req, res) => {
    const { id } = req.params;
    const user = await userManager.getUserById(id);

    res.status(200).json({
      success: true,
      data: user
    });
  });

  getProfile = catchAsync(async (req, res) => {
    // Get current user's profile
    const user = await userManager.getUserById(req.user.id);

    res.status(200).json({
      success: true,
      data: user
    });
  });

  updateUser = catchAsync(async (req, res) => {
    const { id } = req.params;
    const user = await userManager.updateUser(id, req.body);
    logger.info(`User updated: ${id}`);

    res.status(200).json({
      success: true,
      message: 'User updated successfully',
      data: user
    });
  });

  deleteUser = catchAsync(async (req, res) => {
    const { id } = req.params;
    await userManager.deleteUser(id);
    logger.info(`User deleted: ${id}`);

    res.status(200).json({
      success: true,
      message: 'User deleted successfully'
    });
  });
}

export default new UserController();
