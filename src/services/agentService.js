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
        console.log('=== SEARCH PARAMS ===');
        console.log('Query:', params.query);
        console.log('Keyword:', params.keyword);
        console.log('nResults:', params.nResults);
        console.log('=== END PARAMS ===');
        
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
            googleLink: r.googleLink, // PUT FIRST!
            fileName: r.metadata.name,
            folderPath: r.metadata.folderPath || process.env.GOOGLE_DRIVE_FOLDER_ROOT_NAME,
            path: r.path,
            // textPreview: r.text.substring(0, 200) + '...', // Shortened text
            distance: r.distance.toFixed(3)
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
      content: `Ti si AI agent koji pretražuje INTERNE dokumente iz ChromaDB baze podataka.

VAŽNO: TI IMAŠ PRISTUP DOKUMENTIMA! Ne tražiš na internetu, već u lokalnoj bazi dokumenata.

Kada korisnik pita "gde se spominje XYZ" ili "u kom fajlu je XYZ":
1. Koristi searchDocuments alat da pretražiš BAZU dokumenata
2. NIKADA ne kaži "nemam pristup" ili "ne mogu pristupiti internetu"
3. Ako alat vrati prazne rezultate, reci: "Nisam pronašao dokument koji sadrži taj tekst u bazi."

KRITIČNO PRAVILO: UVEK moraš uključiti googleLink URL u svaki odgovor o dokumentima!

Kada pronađeš dokument, odgovori TAČNO u ovom formatu:

Pronašao sam u dokumentu:
📄 **[fileName]**
📂 Putanja: [folderPath]
🔗 Link: [googleLink URL]

Alati koje IMAŠ:
- searchDocuments: Pretražuje ChromaDB bazu dokumenata (ne internet!)
- sendEmail: Slanje emaila
- getDocumentStats: Statistika o bazi dokumenata

Primer DOBROG odgovora:
Korisnik: "Gde se spominje Jelena?"
Ti: "Pronašao sam u dokumentu:
📄 **Nested doc 2**
📂 Putanja: jelena subfolder
🔗 Link: https://docs.google.com/document/d/abc123"

Primer LOŠEG odgovora (NIKADA ovako):
"Žao mi je, ne mogu pristupiti internetu..." ❌`
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

          console.log('=== TOOL RESULT BEING SENT TO GEMINI ===');
          console.log(JSON.stringify(result, null, 2));
          console.log('=== END TOOL RESULT ===');

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

      // Extract googleLinks from search results (if any)
      const searchResults = toolCalls
        .filter((tc) => tc.tool === 'searchDocuments')
        .flatMap((tc) => tc.result?.results || []);

      let finalAnswer = '';

      // Format search results - always use our formatting for consistency
      if (searchResults.length > 0) {
        // Build formatted response
        finalAnswer = `Pronašao sam ${searchResults.length} ${searchResults.length === 1 ? 'dokument' : 'dokumenata'}:\n\n`;
        
        searchResults.forEach((result, index) => {
          // Extract extension from path
          const extension = result.path ? result.path.split('.').pop() : '';
          const fileNameWithExt = extension ? `${result.fileName}.${extension}` : result.fileName;
          
          finalAnswer += `${index + 1}. 📂 **${result.folderPath}**\n`;
          finalAnswer += `   📄 ${fileNameWithExt}\n`;
          if (result.googleLink) {
            finalAnswer += `   🔗 [Otvori dokument](${result.googleLink})\n`;
          }
          finalAnswer += '\n';
        });
      } else {
        // No search results - use Gemini's text response
        finalAnswer = response.text;
      }

      return {
        success: true,
        answer: finalAnswer,
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
