import db from '../../../database/models/index.js';
import { AppError, COMMON_ERRORS } from '../../middleware/errorHandler.js';

const { User } = db;

class UserManager {
  async getAllUsers(filters = {}, sort = {}) {
    const order = sort.field ? [[sort.field, sort.order]] : [['created_at', 'DESC']];

    const users = await User.findAll({
      where: filters,
      order,
      attributes: ['id', 'email', 'name', 'created_at']
    });
    return users;
  }

  async getAllUsersPaginated(filters = {}, sort = {}, pagination = {}) {
    const { limit, offset } = pagination;
    const order = sort.field ? [[sort.field, sort.order]] : [['created_at', 'DESC']];

    const { count, rows } = await User.findAndCountAll({
      where: filters,
      order,
      limit,
      offset,
      attributes: ['id', 'email', 'name', 'created_at']
    });

    return {
      items: rows,
      total: count
    };
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
