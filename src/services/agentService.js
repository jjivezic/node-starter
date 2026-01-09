import { chatWithHistory } from './geminiService.js';
import { search as vectorSearch, getStats as vectorGetStats } from './vectorService.js';
import emailService from './emailService.js';
import logger from '../config/logger.js';
import { AppError } from '../middleware/errorHandler.js';
import { ERROR_CODES } from '../config/errorCodes.js';

/**
 * AI Agent Service
 * Autonomous agent that can use tools to complete tasks
 */

/**
 * Define available tools for the agent
 */
const defineTools = () => {
  return [
    {
      name: 'searchDocuments',
      description: 'Search for documents in the knowledge base. Use keyword parameter for exact text matching, and query for semantic search.',
      parameters: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'The semantic search query - describe what you are looking for'
          },
          keyword: {
            type: 'string',
            description:
              'Exact text to find in documents (case-insensitive). Use this when user asks for specific text like "xyz" or "contract expired"'
          },
          nResults: {
            type: 'number',
            description: 'Number of results to return (default: 10)'
          }
        },
        required: ['query']
      },
      function: async (params) => {
        const results = await vectorSearch(
          params.query,
          params.nResults || 10,
          params.keyword || null,
          null // No distance filter, let all results through
        );
        logger.info(`Found ${results.length} documents`);
        return {
          success: true,
          count: results.length,
          results: results.map((r) => ({
            fileName: r.metadata.name,
            folderPath: r.metadata.folderPath || process.env.GOOGLE_DRIVE_FOLDER_ROOT_NAME,
            fullText: r.text,
            distance: r.distance.toFixed(3),
            path: r.path,
            googleLink: r.googleLink // Direct link to Google Drive/Docs
          }))
        };
      }
    },
    {
      name: 'sendEmail',
      description: 'Send an email to a recipient. Use this when user asks to send information via email.',
      parameters: {
        type: 'object',
        properties: {
          to: {
            type: 'string',
            description: 'Recipient email address'
          },
          subject: {
            type: 'string',
            description: 'Email subject line'
          },
          message: {
            type: 'string',
            description: 'Email message body (plain text or HTML)'
          }
        },
        required: ['to', 'subject', 'message']
      },
      function: async (params) => {
        logger.info('Agent calling sendEmail:', { to: params.to, subject: params.subject });
        await emailService.sendEmail({
          to: params.to,
          subject: params.subject,
          html: params.message
        });
        return {
          success: true,
          message: `Email sent to ${params.to}`
        };
      }
    },
    {
      name: 'getDocumentStats',
      description: 'Get statistics about the document knowledge base',
      parameters: {
        type: 'object',
        properties: {}
      },
      function: async () => {
        logger.info('Agent calling getDocumentStats');
        const stats = await vectorGetStats();
        return {
          success: true,
          stats
        };
      }
    }
  ];
};

// Initialize tools once
const tools = defineTools();

/**
 * Execute agent task with autonomous tool usage
 * @param {string} userPrompt - User's request
 * @param {number} maxIterations - Maximum tool calls to prevent infinite loops
 */
export const executeTask = async (userPrompt, maxIterations = 5) => {
  // Input validation
  if (!userPrompt || typeof userPrompt !== 'string' || userPrompt.trim().length === 0) {
    throw new AppError('Valid prompt is required', 400, true, ERROR_CODES.BAD_REQUEST);
  }

  logger.info('Agent starting task:', { promptLength: userPrompt.length, maxIterations });

  const conversationHistory = [
    {
      role: 'system',
      content: `You are an intelligent AI agent with access to tools. 

IMPORTANT: You MUST use the searchDocuments tool to answer questions about documents.

Your job is to:
1. When user asks about documents or content, ALWAYS call searchDocuments tool first
2. Search the knowledge base (Google Drive files) using searchDocuments
3. Use the results to provide accurate answers
4. Cite which document you found information in

Available tools:
- searchDocuments: Search for documents. Use BOTH parameters:
  * query: Describe what you're looking for (e.g., "documents about contracts")
  * keyword: Exact text to find (e.g., "xyz", "jelena", "contract expired")
- sendEmail: Send emails when requested
- getDocumentStats: Get database statistics

IMPORTANT EXAMPLES:
User: "Find document with xyz text"
You should call: searchDocuments(query: "document with xyz", keyword: "xyz")

User: "Where is text 'jelena' mentioned?"
You should call: searchDocuments(query: "jelena", keyword: "jelena")

User: "Find contract that expired"
You should call: searchDocuments(query: "expired contract", keyword: "expired")

ALWAYS use BOTH query and keyword parameters when user asks for specific text!`
    },
    {
      role: 'user',
      content: userPrompt
    }
  ];

  const toolCalls = [];
  let iterations = 0;

  while (iterations < maxIterations) {
    iterations += 1;
    logger.debug(`Agent iteration ${iterations}/${maxIterations}`);

    // After first tool call, allow Gemini to respond without forcing tools
    const useTools = toolCalls.length === 0; // Only force tools on first iteration

    // Ask Gemini what to do next
    const response = await chatWithHistory(conversationHistory, {
      temperature: 0.7,
      maxTokens: 1000,
      tools: useTools
        ? tools.map((t) => ({
          name: t.name,
          description: t.description,
          parameters: t.parameters
        }))
        : null // Don't send tools after first call, let it respond
    });

    logger.debug('Gemini response received:', {
      hasToolCalls: !!response.toolCalls,
      hasText: !!response.text
    });

    // Check if agent wants to use a tool
    if (response.toolCalls && response.toolCalls.length > 0) {
      logger.info(
        `Agent requested ${response.toolCalls.length} tool calls:`,
        response.toolCalls.map((tc) => tc.name)
      );

      // Execute tool calls
      // Filter out unknown tools and log warnings
      const validToolCalls = response.toolCalls.filter((toolCall) => {
        const tool = tools.find((t) => t.name === toolCall.name);
        if (!tool) {
          logger.warn('Unknown tool requested:', toolCall.name);
          return false;
        }
        return true;
      });

      // Execute tools sequentially to avoid race conditions
      // eslint-disable-next-line no-restricted-syntax
      for (const toolCall of validToolCalls) {
        const tool = tools.find((t) => t.name === toolCall.name);

        logger.debug('Executing tool:', toolCall.name, JSON.stringify(toolCall.parameters));

        try {
          const result = await tool.function(toolCall.parameters);

          toolCalls.push({
            tool: toolCall.name,
            parameters: toolCall.parameters,
            result
          });

          logger.debug(`Tool ${toolCall.name} result:`, JSON.stringify(result).substring(0, 200));

          // Add tool result to conversation
          conversationHistory.push({
            role: 'function',
            name: toolCall.name,
            content: JSON.stringify(result)
          });
        } catch (error) {
          logger.error(`Tool ${toolCall.name} failed:`, error);
          conversationHistory.push({
            role: 'function',
            name: toolCall.name,
            content: JSON.stringify({ error: error.message })
          });
        }
      }

      // Continue loop to get agent's response after using tools
      // eslint-disable-next-line
      continue;
    }

    // Agent has text response
    if (response.text) {
      logger.info('Agent completed task successfully', {
        answerLength: response.text.length,
        toolCallsUsed: toolCalls.length,
        iterations
      });
      return {
        success: true,
        answer: response.text,
        toolCalls,
        iterations
      };
    }

    // No tools and no text - unexpected, break loop
    logger.warn('Agent returned neither tools nor text');
    throw new AppError(
      'Agent did not provide a response',
      500,
      true,
      ERROR_CODES.INTERNAL_ERROR
    );
  }

  // Max iterations reached
  logger.warn('Agent reached max iterations');
  throw new AppError(
    'Task too complex, reached maximum tool usage limit',
    400,
    true,
    ERROR_CODES.BAD_REQUEST
  );
};
