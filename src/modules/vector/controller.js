import { addMany, search, getStats, deleteMany, reset, getAll } from '../../services/vectorService.js';
import logger from '../../config/logger.js';

export const addVectorDocuments = async (req, res, next) => {
  try {
    const { documents } = req.body;

    logger.withRequestId(req.id).info('Adding documents to vector DB', {
      count: documents.length
    });

    const result = await addMany(documents);

    logger.withRequestId(req.id).info('Documents added successfully to vector DB');

    res.json({
      success: true,
      data: result,
      message: 'Documents added successfully'
    });
  } catch (error) {
    logger.withRequestId(req.id).error('Failed to add documents:', error);
    next(error);
  }
};

export const searchVectorDocuments = async (req, res, next) => {
  try {
    const { query, nResults = 5, keyword, maxDistance } = req.body;
    console.log('VectorController.search called with query:', query, 'nResults:', nResults, 'keyword:', keyword, 'maxDistance:', maxDistance);
    logger.withRequestId(req.id).info('Searching vector DB', {
      query,
      nResults,
      keyword,
      maxDistance
    });

    const results = await search(query, nResults, keyword, maxDistance);

    logger.withRequestId(req.id).info('Search completed', {
      resultsFound: results.length
    });

    res.json({
      success: true,
      data: {
        query,
        keyword,
        maxDistance,
        results,
        count: results.length
      },
      message: 'Search completed successfully'
    });
  } catch (error) {
    logger.withRequestId(req.id).error('Search failed:', error);
    next(error);
  }
};

export const getDocumentStats = async (req, res, next) => {
  try {
    logger.withRequestId(req.id).info('Getting vector DB stats');

    const stats = await getStats();

    res.json({
      success: true,
      data: stats,
      message: 'Stats retrieved successfully'
    });
  } catch (error) {
    logger.withRequestId(req.id).error('Failed to get stats:', error);
    next(error);
  }
};

export const deleteVectorDocuments = async (req, res, next) => {
  try {
    const { ids } = req.body;

    logger.withRequestId(req.id).info('Deleting documents from vector DB', {
      count: ids.length
    });

    const result = await deleteMany(ids);

    res.json({
      success: true,
      data: result,
      message: 'Documents deleted successfully'
    });
  } catch (error) {
    logger.withRequestId(req.id).error('Failed to delete documents:', error);
    next(error);
  }
};

export const resetVectorDocuments = async (req, res, next) => {
  try {
    logger.withRequestId(req.id).info('Resetting vector DB');

    const result = await reset();

    res.json({
      success: true,
      data: result,
      message: 'Vector database reset successfully'
    });
  } catch (error) {
    logger.withRequestId(req.id).error('Failed to reset vector DB:', error);
    next(error);
  }
};

export const getAllVectorDocuments = async (req, res, next) => {
  try {
    logger.withRequestId(req.id).info('Getting all documents from vector DB');

    const result = await getAll();

    res.json({
      success: true,
      data: result,
      message: 'Documents retrieved successfully'
    });
  } catch (error) {
    logger.withRequestId(req.id).error('Failed to get documents:', error);
    next(error);
  }
};
