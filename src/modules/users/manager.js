import db from '../../../database/models/index.js';
import { AppError, COMMON_ERRORS } from '../../middleware/errorHandler.js';

const { User } = db;

class UserManager {
  async getAllUsers() {
    const users = await User.findAll({
      attributes: ['id', 'email', 'name', 'created_at']
    });
    return users;
  }

  async getUserById(userId) {
    const user = await User.findByPk(userId, {
      attributes: ['id', 'email', 'name', 'created_at']
    });

    if (!user) {
      throw new AppError(COMMON_ERRORS.NOT_FOUND);
    }

    return user;
  }

  async updateUser(userId, data) {
    const { name, email } = data;
    const updates = {};

    if (name) updates.name = name;
    if (email) updates.email = email;

    if (Object.keys(updates).length === 0) {
      throw new AppError(COMMON_ERRORS.BAD_REQUEST);
    }

    const user = await User.findByPk(userId);
    
    if (!user) {
      throw new AppError(COMMON_ERRORS.NOT_FOUND);
    }

    await user.update(updates);

    return this.getUserById(userId);
  }

  async deleteUser(userId) {
    const user = await User.findByPk(userId);

    if (!user) {
      throw new AppError(COMMON_ERRORS.NOT_FOUND);
    }

    await user.destroy();

    return { success: true };
  }
}

export default new UserManager();
