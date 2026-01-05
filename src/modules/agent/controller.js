import agentService from '../../services/agentService.js';
import logger from '../../config/logger.js';

/**
 * @swagger
 * tags:
 *   name: Agent
 *   description: AI Agent that can autonomously use tools to complete tasks
 */

/**
 * @swagger
 * /api/agent/task:
 *   post:
 *     summary: Execute an autonomous AI agent task
 *     tags: [Agent]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - prompt
 *             properties:
 *               prompt:
 *                 type: string
 *                 description: Task description for the agent
 *                 example: "Find all documents mentioning 'Jelena' and summarize them"
 *               maxIterations:
 *                 type: number
 *                 default: 5
 *                 description: Maximum tool calls allowed
 *     responses:
 *       200:
 *         description: Agent task completed
 *       400:
 *         description: Invalid request
 *       500:
 *         description: Server error
 */
export const executeTask = async (req, res, next) => {
  try {
    const { prompt, maxIterations = 5 } = req.body;
    console.log('AgentController.executeTask called with prompt:', prompt, 'maxIterations:', maxIterations);
    logger.withRequestId(req.id).info('Agent task requested:', {
      prompt,
      maxIterations
    });

    const result = await agentService.executeTask(prompt, maxIterations);

    logger.withRequestId(req.id).info('Agent task completed', {
      success: result.success,
      toolCallsCount: result.toolCalls.length,
      iterations: result.iterations
    });

    res.json({
      success: true,
      data: result,
      message: 'Agent task completed'
    });
  } catch (error) {
    logger.withRequestId(req.id).error('Agent task failed:', error);
    next(error);
  }
};
