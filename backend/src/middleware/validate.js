import { parse } from '../utils/errors.js';
export const validate = (schema) => (req, res, next) => {
  req.input = parse(schema, req.body);
  next();
};
