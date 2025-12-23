import db from '../../../database/models/index.js';
import { AppError, COMMON_ERRORS } from '../../middleware/errorHandler.js';

const { Product } = db;

class ProductManager {
  async getAll() {
    const items = await Product.findAll();
    return items;
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
    return await this.getById(id);
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
