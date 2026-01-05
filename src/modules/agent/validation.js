import Joi from 'joi';

export const executeTaskValidation = {
  body: Joi.object({
    prompt: Joi.string().required().min(3).max(1000),
    maxIterations: Joi.number().integer().min(1).max(10).default(5)
  })
};
