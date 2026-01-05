import vectorService from '../../services/vectorService.js';
import logger from '../../config/logger.js';

/**
 * @swagger
 * tags:
 *   name: Vector
 *   description: Vector database operations for RAG
 */

/**
 * @swagger
 * /api/vector/add:
 *   post:
 *     summary: Add documents to vector database
 *     tags: [Vector]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - documents
 *             properties:
 *               documents:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                     text:
 *                       type: string
 *                     metadata:
 *                       type: object
 *                 example:
 *                   - id: "doc1"
 *                     text: "Node.js is a JavaScript runtime"
 *                     metadata:
 *                       fileName: "nodejs-guide.txt"
 *                       category: "programming"
 *     responses:
 *       200:
 *         description: Documents added successfully
 *       400:
 *         description: Invalid request
 *       500:
 *         description: Server error
 */
export const addDocuments = async (req, res, next) => {
  try {
    const { documents } = req.body;

    logger.withRequestId(req.id).info('Adding documents to vector DB', {
      count: documents.length
    });

    const result = await vectorService.addDocuments(documents);

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

/**
 * @swagger
 * /api/vector/search:
 *   post:
 *     summary: Search for similar documents
 *     tags: [Vector]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - query
 *             properties:
 *               query:
 *                 type: string
 *                 example: "How to use async/await in Node.js?"
 *               nResults:
 *                 type: number
 *                 default: 5
 *     responses:
 *       200:
 *         description: Search results returned
 *       400:
 *         description: Invalid request
 *       500:
 *         description: Server error
 */
export const search = async (req, res, next) => {
  try {
    const { query, nResults = 5, keyword, maxDistance } = req.body;
    console.log('VectorController.search called with query:', query, 'nResults:', nResults, 'keyword:', keyword, 'maxDistance:', maxDistance);
    logger.withRequestId(req.id).info('Searching vector DB', {
      query,
      nResults,
      keyword,
      maxDistance
    });

    const results = await vectorService.search(query, nResults, keyword, maxDistance);

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

/**
 * @swagger
 * /api/vector/stats:
 *   get:
 *     summary: Get vector database statistics
 *     tags: [Vector]
 *     responses:
 *       200:
 *         description: Statistics returned
 */
export const getStats = async (req, res, next) => {
  try {
    logger.withRequestId(req.id).info('Getting vector DB stats');

    const stats = await vectorService.getStats();

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

/**
 * @swagger
 * /api/vector/delete:
 *   post:
 *     summary: Delete documents by IDs
 *     tags: [Vector]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - ids
 *             properties:
 *               ids:
 *                 type: array
 *                 items:
 *                   type: string
 *                 example: ["doc1", "doc2"]
 *     responses:
 *       200:
 *         description: Documents deleted
 */
export const deleteDocuments = async (req, res, next) => {
  try {
    const { ids } = req.body;

    logger.withRequestId(req.id).info('Deleting documents from vector DB', {
      count: ids.length
    });

    const result = await vectorService.deleteDocuments(ids);

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

/**
 * @swagger
 * /api/vector/reset:
 *   post:
 *     summary: Reset vector database (delete all documents)
 *     tags: [Vector]
 *     responses:
 *       200:
 *         description: Database reset
 */
export const reset = async (req, res, next) => {
  try {
    logger.withRequestId(req.id).info('Resetting vector DB');

    const result = await vectorService.reset();

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

/**
 * @swagger
 * /api/vector/all:
 *   get:
 *     summary: Get all documents
 *     tags: [Vector]
 *     responses:
 *       200:
 *         description: All documents returned
 */
export const getAllDocuments = async (req, res, next) => {
  try {
    logger.withRequestId(req.id).info('Getting all documents from vector DB');

    const result = await vectorService.getAllDocuments();

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
