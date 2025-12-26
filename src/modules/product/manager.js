import db from '../../../database/models/index.js';
import { AppError, COMMON_ERRORS } from '../../middleware/errorHandler.js';

const { Product } = db;

class ProductManager {
  async getAll(filters = {}, sort = {}) {
    const order = sort.field ? [[sort.field, sort.order]] : [['created_at', 'DESC']];

    const items = await Product.findAll({
      where: filters,
      order
    });
    
    return items;
  }

  async getAllPaginated(filters = {}, sort = {}, pagination = {}) {
    const { limit, offset } = pagination;
    const order = sort.field ? [[sort.field, sort.order]] : [['created_at', 'DESC']];

    const { count, rows } = await Product.findAndCountAll({
      where: filters,
      order,
      limit,
      offset
    });

    return {
      items: rows,
      total: count
    };
  }

  async getById(id) {
    const item = await Product.findByPk(id);

    if (!item) {
      throw new AppError(COMMON_ERRORS.NOT_FOUND);
    }

    return item;
  }

  async create(data) {
    const item = await Product.create(data);
    return item;
  }

  async update(id, data) {
    const item = await Product.findByPk(id);
    
    if (!item) {
      throw new AppError(COMMON_ERRORS.NOT_FOUND);
    }

    await item.update(data);
    return this.getById(id);
  }

  async delete(id) {
    const item = await Product.findByPk(id);

    if (!item) {
      throw new AppError(COMMON_ERRORS.NOT_FOUND);
    }

    await item.destroy();
    return { success: true };
  }
}

export default new ProductManager();
