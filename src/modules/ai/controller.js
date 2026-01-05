import openaiService from '../../services/openaiService.js';
import geminiService from '../../services/geminiService.js';
import logger from '../../config/logger.js';

/**
 * @swagger
 * tags:
 *   name: AI
 *   description: AI integration endpoints (OpenAI & Google Gemini)
 */

/**
 * @swagger
 * /api/ai/chat:
 *   post:
 *     summary: Send a simple chat prompt to AI (OpenAI or Gemini)
 *     tags: [AI]
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
 *                 description: The prompt to send to AI
 *                 example: "Explain quantum computing in simple terms"
 *               provider:
 *                 type: string
 *                 enum: [openai, gemini]
 *                 default: gemini
 *                 description: AI provider to use
 *               model:
 *                 type: string
 *                 description: Model name (provider-specific)
 *                 example: "gemini-1.5-flash"
 *               maxTokens:
 *                 type: number
 *                 default: 500
 *               temperature:
 *                 type: number
 *                 minimum: 0
 *                 maximum: 2
 *                 default: 0.7
 *     responses:
 *       200:
 *         description: AI response generated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     prompt:
 *                       type: string
 *                     response:
 *                       type: string
 *                     model:
 *                       type: string
 *       400:
 *         description: Invalid request
 *       500:
 *         description: Server error
 */
export const chat = async (req, res, next) => {
  try {
    const { prompt, provider = 'gemini', model, maxTokens = 500, temperature = 0.7 } = req.body;

    logger.withRequestId(req.id).info('Processing AI chat request', {
      promptLength: prompt.length,
      provider,
      model,
    });

    let response;
    let usedModel;

    if (provider === 'gemini') {
      usedModel = model || 'gemini-2.0-flash-exp';
      response = await geminiService.chat(prompt, {
        model: usedModel,
        maxTokens,
        temperature,
      });
    } else if (provider === 'openai') {
      usedModel = model || 'gpt-3.5-turbo';
      response = await openaiService.chat(prompt, {
        model: usedModel,
        maxTokens,
        temperature,
      });
    } else {
      throw new Error(`Unsupported provider: ${provider}`);
    }

    logger.withRequestId(req.id).info('AI chat request completed successfully');

    res.json({
      success: true,
      data: {
        prompt,
        response,
        provider,
        model: usedModel,
      },
      message: 'AI response generated successfully',
    });
  } catch (error) {
    logger.withRequestId(req.id).error('AI chat request failed:', error);
    next(error);
  }
};

/**
 * @swagger
 * /api/ai/chat-history:
 *   post:
 *     summary: Send a conversation with history to OpenAI
 *     tags: [AI]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - messages
 *             properties:
 *               messages:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     role:
 *                       type: string
 *                       enum: [system, user, assistant]
 *                     content:
 *                       type: string
 *                 example:
 *                   - role: "system"
 *                     content: "You are a helpful assistant"
 *                   - role: "user"
 *                     content: "What is the capital of France?"
 *                   - role: "assistant"
 *                     content: "The capital of France is Paris"
 *                   - role: "user"
 *                     content: "What about Spain?"
 *               model:
 *                 type: string
 *                 enum: [gpt-3.5-turbo, gpt-4, gpt-4-turbo-preview]
 *                 default: gpt-3.5-turbo
 *               maxTokens:
 *                 type: number
 *                 default: 500
 *               temperature:
 *                 type: number
 *                 minimum: 0
 *                 maximum: 2
 *                 default: 0.7
 *     responses:
 *       200:
 *         description: AI response generated successfully
 *       400:
 *         description: Invalid request
 *       500:
 *         description: Server error
 */
export const chatWithHistory = async (req, res, next) => {
  try {
    const { messages, provider = 'gemini', model, maxTokens = 500, temperature = 0.7 } = req.body;

    logger.withRequestId(req.id).info('Processing AI chat with history', {
      messageCount: messages.length,
      provider,
      model,
    });

    let response;
    let usedModel;

    if (provider === 'gemini') {
      usedModel = model || 'gemini-2.0-flash-exp';
      response = await geminiService.chatWithHistory(messages, {
        model: usedModel,
        maxTokens,
        temperature,
      });
    } else if (provider === 'openai') {
      usedModel = model || 'gpt-3.5-turbo';
      response = await openaiService.chatWithHistory(messages, {
        model: usedModel,
        maxTokens,
        temperature,
      });
    } else {
      throw new Error(`Unsupported provider: ${provider}`);
    }

    logger
      .withRequestId(req.id)
      .info('AI chat with history completed successfully');

    res.json({
      success: true,
      data: {
        messages,
        response,
        provider,
        model: usedModel,
      },
      message: 'AI response generated successfully',
    });
  } catch (error) {
    logger
      .withRequestId(req.id)
      .error('AI chat with history request failed:', error);
    next(error);
  }
};

/**
 * @swagger
 * /api/ai/examples:
 *   get:
 *     summary: Get example prompts
 *     tags: [AI]
 *     responses:
 *       200:
 *         description: Example prompts returned successfully
 */
export const getExamples = async (req, res, next) => {
  try {
    const examples = [
      {
        category: 'Creative Writing',
        prompts: [
          'Write a short story about a time traveler',
          'Create a poem about nature',
          'Generate a creative product description for a smart watch',
        ],
      },
      {
        category: 'Code Assistance',
        prompts: [
          'Explain what a closure is in JavaScript',
          'Write a function to reverse a string in Python',
          'How do I use async/await in Node.js?',
        ],
      },
      {
        category: 'General Knowledge',
        prompts: [
          'Explain quantum computing in simple terms',
          'What are the main differences between React and Vue?',
          'Summarize the history of the Internet',
        ],
      },
      {
        category: 'Problem Solving',
        prompts: [
          'How can I improve my time management?',
          'What are best practices for API design?',
          'Give me tips for learning a new programming language',
        ],
      },
    ];

    res.json({
      success: true,
      data: examples,
      message: 'Example prompts retrieved successfully',
    });
  } catch (error) {
    logger.withRequestId(req.id).error('Failed to get examples:', error);
    next(error);
  }
};
