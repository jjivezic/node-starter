import { chatWithHistory, chat } from './geminiService.js';
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
          message: `Email sent to ${params.to}`,
          sentEmail: {
            to: params.to,
            subject: params.subject,
            body: params.message
          }
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
    },
    {
      name: 'summarizeDocument',
      description:
        'Generate a summary of a specific document. Use when user asks to summarize a document or get document overview.',
      parameters: {
        type: 'object',
        properties: {
          documentName: {
            type: 'string',
            description: 'Name or part of the name of the document to summarize (e.g., "OPENAI VS CLAUDE")'
          },
          maxLength: {
            type: 'number',
            description: 'Maximum length of summary in words (default: 200)'
          }
        },
        required: ['documentName']
      },
      function: async (params) => {
        logger.info('Agent calling summarizeDocument:', { documentName: params.documentName });

        // Remove file extension for better matching
        const documentNameWithoutExt = params.documentName.replace(/\.(pdf|docx?|xlsx?|txt|pptx?)$/i, '');
        
        // Try exact match first using metadata filter
        let searchResults = await vectorSearch(
          documentNameWithoutExt,
          5,
          null, // No keyword filter
          null, // No distance filter
          { name: params.documentName } // Exact metadata match
        );

        console.log('=== SEARCH WITH EXACT NAME FILTER ===');
        console.log('Looking for name:', params.documentName);
        console.log('Results:', searchResults?.length || 0);
        console.log('=== END EXACT SEARCH ===');

        // If no exact match, try partial match with keyword
        if (!searchResults || searchResults.length === 0) {
          logger.debug('No exact match, trying partial match');
          searchResults = await vectorSearch(
            documentNameWithoutExt,
            5,
            documentNameWithoutExt, // Use as keyword
            null
          );
          
          console.log('=== SEARCH WITH PARTIAL MATCH ===');
          console.log('Keyword:', documentNameWithoutExt);
          console.log('Results:', searchResults?.length || 0);
          if (searchResults?.length > 0) {
            console.log('Found:', searchResults.map(r => r.metadata.name));
          }
          console.log('=== END PARTIAL SEARCH ===');
        }

        if (!searchResults || searchResults.length === 0) {
          logger.warn('No document found with name:', params.documentName);
          return {
            success: false,
            message: `Nisam pronašao dokument sa nazivom "${params.documentName}" u bazi.`
          };
        }

        // Get the best match (first result after sorting)
        const document = searchResults[0];
        logger.info('Document found for summarization:', {
          fileName: document.metadata.name,
          textLength: document.text?.length || 0
        });

        // Get full text from the document
        const fullText = document.text || '';

        if (fullText.length === 0) {
          logger.warn('Document has no text content:', document.metadata.name);
          return {
            success: false,
            message: `Dokument "${document.metadata.name}" ne sadrži tekst za sažimanje.`
          };
        }

        // Generate summary using Gemini
        const maxLength = params.maxLength || 200;
        const summaryPrompt = `Napravi sažetak sledećeg dokumenta u maksimalno ${maxLength} reči. Fokusiraj se na glavne teme i ključne informacije.\n\nDokument:\n${fullText}`;

        logger.debug('Generating summary with Gemini:', { textLength: fullText.length, maxLength });
        const summary = await chat(summaryPrompt);

        logger.info('Summary generated:', { summaryLength: summary.length });

        return {
          success: true,
          documentName: document.metadata.name,
          folderPath: document.metadata.folderPath || process.env.GOOGLE_DRIVE_FOLDER_ROOT_NAME,
          googleLink: document.googleLink,
          extension: document.metadata.extension,
          summary,
          originalLength: fullText.length,
          summaryLength: summary.split(/\s+/).length // Word count
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

KRITIČNA PRAVILA:
1. IMAŠ pristup dokumentima u ChromaDB bazi!
2. UVEK koristi alate - NIKADA ne odgovaraj direktno bez alata!
3. NIKADA ne kaži "nemam pristup", "ne mogu otvoriti", "ne mogu pročitati" - TO JE LAŽ!
4. Dokumenti su VEĆ U BAZI - samo koristi alat!

ALATI:
- searchDocuments: Pretraga dokumenata u bazi
- summarizeDocument: Sažetak dokumenta iz baze (MORA da se koristi za zahteve "napravi sažetak")
- sendEmail: Slanje emaila
- getDocumentStats: Statistika

OBRATI PAŽNJU:
Kada korisnik kaže "napravi sažetak dokumenta XYZ":
- MORAŠ koristiti summarizeDocument alat
- Parametar documentName: "XYZ" (ime dokumenta)
- NIKADA direktno ne odgovaraj bez alata!

Kada korisnik kaže "gde se spominje XYZ":
- MORAŠ koristiti searchDocuments alat
- NIKADA direktno ne odgovaraj!

Ako alat vrati error/prazno: "Nisam pronašao dokument u bazi."
Ali NIKADA ne kaži da ne možeš pristupiti - dokumenti su u bazi!`
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
    const forceTools = toolCalls.length === 0; // Force tools on first iteration only

    // Ask Gemini what to do next
    const response = await chatWithHistory(conversationHistory, {
      temperature: 0.7,
      maxTokens: 1000,
      tools: tools.map((t) => ({
        name: t.name,
        description: t.description,
        parameters: t.parameters
      })),
      forceToolUse: forceTools // Pass flag to force tool usage on first iteration
    });

    logger.debug('Gemini response received:', {
      hasToolCalls: !!response.toolCalls,
      hasText: !!response.text
    });

    // Check if agent wants to use a tool
    if (response.toolCalls && response.toolCalls.length > 0) {
      console.log('=== TOOLS REQUESTED BY GEMINI ===');
      console.log('Tool names:', response.toolCalls.map((tc) => tc.name));
      console.log('Tool parameters:', JSON.stringify(response.toolCalls, null, 2));
      console.log('=== END TOOL REQUEST ===');
      
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

        console.log('=== EXECUTING TOOL ===');
        console.log('Tool name:', toolCall.name);
        console.log('Parameters:', JSON.stringify(toolCall.parameters, null, 2));
        console.log('=== START EXECUTION ===');

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

      // Extract sent emails (if any)
      const sentEmails = toolCalls
        .filter((tc) => tc.tool === 'sendEmail')
        .flatMap((tc) => tc.result?.sentEmail ? [tc.result.sentEmail] : []);

      // Extract summaries (if any)
      const summaries = toolCalls
        .filter((tc) => tc.tool === 'summarizeDocument')
        .flatMap((tc) => tc.result?.success ? [tc.result] : []);

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
            finalAnswer += `   🔗 <a href="${result.googleLink}" target="_blank" rel="noopener noreferrer">Otvori dokument</a>\n`;
          }
          finalAnswer += '\n';
        });
      } else if (summaries.length > 0) {
        // Format document summary
        finalAnswer = '';
        summaries.forEach((summary) => {
          const extension = summary.extension || 'doc';
          const fileNameWithExt = `${summary.documentName}.${extension}`;
          
          finalAnswer += `📝 **Sažetak dokumenta: ${fileNameWithExt}**\n\n`;
          finalAnswer += `📂 Folder: ${summary.folderPath}\n\n`;
          finalAnswer += `${summary.summary}\n\n`;
          finalAnswer += `📊 Originalna dužina: ${summary.originalLength} karaktera\n`;
          finalAnswer += `📊 Dužina sažetka: ${summary.summaryLength} reči\n\n`;
          if (summary.googleLink) {
            finalAnswer += `  🔗 <a href="${summary.googleLink}" target="_blank" rel="noopener noreferrer">Otvori dokument</a>\n`;
          }
        });
      } else if (sentEmails.length > 0) {
        // Format sent email details
        finalAnswer = '✅ Email uspešno poslat!\n\n';
        sentEmails.forEach((email) => {
          finalAnswer += `📧 **Primalac:** ${email.to}\n`;
          finalAnswer += `📋 **Predmet:** ${email.subject}\n`;
          finalAnswer += `📝 **Poruka:**\n${email.body}\n`;
        });
      } else {
        // No search results or emails - use Gemini's text response
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
