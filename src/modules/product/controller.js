import productManager from './manager.js';
import { catchAsync } from '../../middleware/errorHandler.js';
import logger from '../../config/logger.js';

export const getAllPaginated = catchAsync(async (req, res) => {
  const { items, total } = await productManager.getAllPaginated(
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

export const getAll = catchAsync(async (req, res) => {
  const items = await productManager.getAll(
    req.filters || {},
    req.sort || {}
  );

  res.status(200).json({
    success: true,
    data: items
  });
});

export const getById = catchAsync(async (req, res) => {
  const { id } = req.params;
  const item = await productManager.getById(id);

  res.status(200).json({
    success: true,
    data: item
  });
});

export const create = catchAsync(async (req, res) => {
  const item = await productManager.create(req.body);
  logger.info(`Product created: ${item.id}`);

  res.status(201).json({
    success: true,
    message: 'Product created successfully',
    data: item
  });
});

export const update = catchAsync(async (req, res) => {
  const { id } = req.params;
  const item = await productManager.update(id, req.body);
  logger.info(`Product updated: ${id}`);

  res.status(200).json({
    success: true,
    message: 'Product updated successfully',
    data: item
  });
});

export const deleteProduct = catchAsync(async (req, res) => {
  const { id } = req.params;
  await productManager.delete(id);
  logger.info(`Product deleted: ${id}`);

  res.status(200).json({
    success: true,
    message: 'Product deleted successfully'
  });
});
