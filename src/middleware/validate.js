import { AppError } from './errorHandler.js';

export const validate = (schema, source = 'body') => {
  return (req, res, next) => {
    const data = req[source];
    console.log('Validating data***********:', schema, data);
    const { error, value } = schema.validate(data, {
      abortEarly: false,
      stripUnknown: true
    });

    if (error) {
      const message = error.details.map((detail) => detail.message).join(', ');
      throw new AppError(message, 400);
    }

    req[source] = value;
    next();
  };
};
