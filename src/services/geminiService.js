import { GoogleGenerativeAI } from '@google/generative-ai';
import logger from '../config/logger.js';

// Initialize Google AI client
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

/**
 * Send a simple chat prompt to Gemini
 * @param {string} prompt - The user's prompt
 * @param {Object} options - Additional options
 * @param {string} options.model - Model to use (default: gemini-1.5-flash)
 * @param {number} options.maxTokens - Maximum tokens in response
 * @param {number} options.temperature - Creativity level (0-2)
 * @returns {Promise<string>} - The AI response
 */
export const chat = async (prompt, options = {}) => {
  const { model = 'gemini-2.0-flash-exp', maxTokens = 500, temperature = 0.7 } = options;

  try {
    logger.info('Sending prompt to Gemini', {
      model,
      promptLength: prompt.length
    });

    const genModel = genAI.getGenerativeModel({
      model,
      generationConfig: {
        maxOutputTokens: maxTokens,
        temperature
      }
    });

    const result = await genModel.generateContent(prompt);
    const response = await result.response;
    const content = response.text();

    logger.info('Received response from Gemini', {
      model,
      responseLength: content.length
    });

    return content;
  } catch (error) {
    logger.error('Gemini API error:', error);
    throw new Error(`Gemini API error: ${error.message}`);
  }
};

/**
 * Send a chat with conversation history
 * @param {Array} messages - Array of message objects {role, content}
 * @param {Object} options - Additional options
 * @param {Array} options.tools - Function/tool definitions for agent
 * @returns {Promise<Object>} - Response with text and/or tool calls
 */
export const chatWithHistory = async (messages, options = {}) => {
  const { model = 'gemini-2.0-flash-exp', maxTokens = 500, temperature = 0.7, tools = null } = options;

  try {
    logger.info('Sending conversation to Gemini', {
      model,
      messageCount: messages.length,
      hasTools: !!tools
    });

    const modelConfig = {
      model,
      generationConfig: {
        maxOutputTokens: maxTokens,
        temperature
      }
    };

    // Add tools/functions if provided (for agent)
    if (tools && tools.length > 0) {
      modelConfig.tools = [
        {
          functionDeclarations: tools.map((tool) => ({
            name: tool.name,
            description: tool.description,
            parameters: tool.parameters
          }))
        }
      ];

      // Force Gemini to use tools when available
      modelConfig.toolConfig = {
        functionCallingConfig: {
          mode: 'ANY' // Force Gemini to ALWAYS use a tool
        }
      };

      // console.log('🔧 Tools being sent to Gemini:', JSON.stringify(modelConfig.tools, null, 2));
      console.log('⚙️ Tool config:', modelConfig.toolConfig);
    }

    const genModel = genAI.getGenerativeModel(modelConfig);

    // Convert messages to Gemini format
    const history = [];
    for (let i = 0; i < messages.length - 1; i += 1) {
      const msg = messages[i];
      // eslint-disable-next-line no-continue
      if (msg.role === 'system') continue; // Skip system messages in history
      if (msg.role === 'function') {
        // Function result
        history.push({
          role: 'function',
          parts: [
            {
              functionResponse: {
                name: msg.name,
                response: JSON.parse(msg.content)
              }
            }
          ]
        });
      } else {
        history.push({
          role: msg.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: msg.content }]
        });
      }
    }

    const lastMessage = messages[messages.length - 1];
    const geminiChat = genModel.startChat({ history });

    const result = await geminiChat.sendMessage(lastMessage.content);
    const response = await result.response;

    console.log('📨 Raw Gemini response candidates:', JSON.stringify(response.candidates, null, 2));

    // Check for function calls in different ways
    const functionCalls = response.functionCalls?.();
    const candidateParts = response.candidates?.[0]?.content?.parts;
    const hasFunctionCall = candidateParts?.some((part) => part.functionCall);

    console.log('🔧 Function calls check:', {
      hasFunctionCallsMethod: typeof response.functionCalls === 'function',
      functionCallsResult: functionCalls,
      candidateParts,
      hasFunctionCall
    });

    // Try to extract function calls from candidates
    if (hasFunctionCall) {
      const extractedCalls = candidateParts
        .filter((part) => part.functionCall)
        .map((part) => ({
          name: part.functionCall.name,
          parameters: part.functionCall.args
        }));

      console.log(
        '✅ Gemini requested tool calls (from candidates):',
        extractedCalls.map((fc) => fc.name)
      );
      return { toolCalls: extractedCalls };
    }

    if (functionCalls && functionCalls.length > 0) {
      console.log(
        '✅ Gemini requested tool calls (from method):',
        functionCalls.map((fc) => fc.name)
      );
      return {
        toolCalls: functionCalls.map((fc) => ({
          name: fc.name,
          parameters: fc.args
        }))
      };
    }

    const content = response.text();

    logger.info('Received response from Gemini', {
      model,
      responseLength: content.length
    });

    return { text: content };
  } catch (error) {
    logger.error('Gemini API error:', error);
    throw new Error(`Gemini API error: ${error.message}`);
  }
};

/**
 * Generate embeddings for text (for RAG/Vector search)
 * @param {string} text - Text to embed
 * @param {string} model - Embedding model (default: text-embedding-004)
 * @returns {Promise<Array>} - Array of embedding values
 */
export const createEmbedding = async (text, model = 'text-embedding-004') => {
  try {
    logger.info('Creating embedding with Gemini', {
      model,
      textLength: text.length
    });

    const embeddingModel = genAI.getGenerativeModel({ model });
    const result = await embeddingModel.embedContent(text);
    const { embedding } = result;

    logger.info('Embedding created', {
      dimensions: embedding.values.length
    });

    return embedding.values;
  } catch (error) {
    logger.error('Gemini embedding error:', error);
    throw new Error(`Gemini embedding error: ${error.message}`);
  }
};

/**
 * Analyze image with text prompt
 * @param {string} prompt - Text prompt
 * @param {Buffer|string} imageData - Image buffer or base64 string
 * @param {string} mimeType - Image MIME type (default: image/jpeg)
 * @returns {Promise<string>} - The AI response
 */
export const analyzeImage = async (prompt, imageData, mimeType = 'image/jpeg') => {
  try {
    logger.info('Analyzing image with Gemini', {
      promptLength: prompt.length,
      mimeType
    });

    const model = genAI.getGenerativeModel({ model: 'gemini-pro-vision' });

    const imagePart = {
      inlineData: {
        data: Buffer.isBuffer(imageData) ? imageData.toString('base64') : imageData,
        mimeType
      }
    };

    const result = await model.generateContent([prompt, imagePart]);
    const response = await result.response;
    const content = response.text();

    logger.info('Image analysis completed', {
      responseLength: content.length
    });

    return content;
  } catch (error) {
    logger.error('Gemini image analysis error:', error);
    throw new Error(`Gemini image analysis error: ${error.message}`);
  }
};
