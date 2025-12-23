import productManager from './manager.js';
import { catchAsync, AppError } from '../../middleware/errorHandler.js';
import logger from '../../config/logger.js';

class ProductController {
  getAll = catchAsync(async (req, res, next) => {
    const items = await productManager.getAll();

    res.status(200).json({
      success: true,
      data: items
    });
  });

  getById = catchAsync(async (req, res, next) => {
    const { id } = req.params;
    const item = await productManager.getById(id);

    res.status(200).json({
      success: true,
      data: item
    });
  });

  create = catchAsync(async (req, res, next) => {
    const item = await productManager.create(req.body);
    logger.info(`Product created: ${item.id}`);

    res.status(201).json({
      success: true,
      message: 'Product created successfully',
      data: item
    });
  });

  update = catchAsync(async (req, res, next) => {
    const { id } = req.params;
    const item = await productManager.update(id, req.body);
    logger.info(`Product updated: ${id}`);

    res.status(200).json({
      success: true,
      message: 'Product updated successfully',
      data: item
    });
  });

  delete = catchAsync(async (req, res, next) => {
    const { id } = req.params;
    await productManager.delete(id);
    logger.info(`Product deleted: ${id}`);

    res.status(200).json({
      success: true,
      message: 'Product deleted successfully'
    });
  });
}

export default new ProductController();
