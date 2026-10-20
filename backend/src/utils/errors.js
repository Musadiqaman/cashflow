export class AppError extends Error {
  constructor(status, code, message, fields) {
    super(message);
    this.status = status;
    this.code = code;
    this.fields = fields;
  }
}
export function parse(schema, data) {
  const result = schema.safeParse(data);
  if (!result.success)
    throw new AppError(
      400,
      'VALIDATION_ERROR',
      'Please check the highlighted fields.',
      Object.fromEntries(result.error.issues.map((i) => [i.path.join('.'), i.message])),
    );
  return result.data;
}
