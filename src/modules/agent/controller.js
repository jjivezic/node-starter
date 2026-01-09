import { executeTask } from '../../services/agentService.js';
import logger from '../../config/logger.js';
import { catchAsync } from '../../middleware/errorHandler.js';

export const agentExecuteTask = catchAsync(async (req, res) => {
  const { prompt, maxIterations = 5 } = req.body;
  logger.withRequestId(req.id).info('Agent task requested:', {
    prompt,
    maxIterations
  });

  const result = await executeTask(prompt, maxIterations);

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
});
