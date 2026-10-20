import { AppError } from '../utils/errors.js';
import { logger } from '../config/logger.js';
export function errorHandler(error, req, res, next) {
  if (res.headersSent) return next(error);
  let err = error;
  if (error.type === 'entity.too.large')
    err = new AppError(413, 'BODY_TOO_LARGE', 'The request is too large.');
  if (error.type === 'entity.parse.failed')
    err = new AppError(400, 'INVALID_JSON', 'The request contains invalid JSON.');
  if (error.code === 11000 && !(error instanceof AppError))
    err = new AppError(
      409,
      'CONFLICT',
      'This record already exists. Please refresh and try again.',
    );
  if (!(err instanceof AppError)) {
    logger.error({ requestId: req.id, errorType: err.name, code: err.code }, 'Request failed');
    err = new AppError(500, 'INTERNAL_ERROR', 'Something went wrong. Please try again.');
  }
  res.status(err.status).json({
    error: { code: err.code, message: err.message, fields: err.fields, requestId: req.id },
  });
}
