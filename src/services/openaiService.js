import OpenAI from 'openai';
import logger from '../config/logger.js';

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/**
 * Send a simple chat completion request
 * @param {string} prompt - The user's prompt
 * @param {Object} options - Additional options
 * @param {string} options.model - Model to use (default: gpt-3.5-turbo)
 * @param {number} options.maxTokens - Maximum tokens in response
 * @param {number} options.temperature - Creativity level (0-2)
 * @returns {Promise<string>} - The AI response
 */
export const chat = async (prompt, options = {}) => {
  const {
    model = 'gpt-3.5-turbo',
    maxTokens = 500,
    temperature = 0.7,
  } = options;

  try {
    logger.info('Sending prompt to OpenAI', {
      model,
      promptLength: prompt.length,
    });

    const response = await openai.chat.completions.create({
      model,
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
      max_tokens: maxTokens,
      temperature,
    });

    const { content } = response.choices[0].message;

    logger.info('Received response from OpenAI', {
      model,
      tokensUsed: response.usage.total_tokens,
    });

    return content;
  } catch (error) {
    logger.error('OpenAI API error:', error);
    throw new Error(`OpenAI API error: ${error.message}`);
  }
};

/**
 * Send a chat completion with conversation history
 * @param {Array} messages - Array of message objects {role, content}
 * @param {Object} options - Additional options
 * @returns {Promise<string>} - The AI response
 */
export const chatWithHistory = async (messages, options = {}) => {
  const {
    model = 'gpt-3.5-turbo',
    maxTokens = 500,
    temperature = 0.7,
  } = options;

  try {
    logger.info('Sending conversation to OpenAI', {
      model,
      messageCount: messages.length,
    });

    const response = await openai.chat.completions.create({
      model,
      messages,
      max_tokens: maxTokens,
      temperature,
    });

    const { content } = response.choices[0].message;

    logger.info('Received response from OpenAI', {
      model,
      tokensUsed: response.usage.total_tokens,
    });

    return content;
  } catch (error) {
    logger.error('OpenAI API error:', error);
    throw new Error(`OpenAI API error: ${error.message}`);
  }
};

/**
 * Generate text completion (for simpler use cases)
 * @param {string} prompt - The prompt
 * @param {Object} options - Additional options
 * @returns {Promise<string>} - The AI response
 */
export const complete = async (prompt, options = {}) => {
  const {
    model = 'gpt-3.5-turbo-instruct',
    maxTokens = 500,
    temperature = 0.7,
  } = options;

  try {
    logger.info('Sending completion request to OpenAI', {
      model,
      promptLength: prompt.length,
    });

    const response = await openai.completions.create({
      model,
      prompt,
      max_tokens: maxTokens,
      temperature,
    });

    const content = response.choices[0].text;

    logger.info('Received completion from OpenAI', {
      model,
      tokensUsed: response.usage.total_tokens,
    });

    return content;
  } catch (error) {
    logger.error('OpenAI API error:', error);
    throw new Error(`OpenAI API error: ${error.message}`);
  }
};
