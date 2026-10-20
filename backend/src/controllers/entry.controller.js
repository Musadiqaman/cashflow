import * as service from '../services/entry.service.js';
import { parse } from '../utils/errors.js';
import {
  categories,
  createSchema,
  editSchema,
  voidSchema,
  keySchema,
  idSchema,
  querySchema,
  entryInput,
} from '../validators/entry.validator.js';
export const categoryList = (req, res) => res.json({ categories });
export const list = async (req, res) =>
  res.json(await service.listEntries(req.user._id, parse(querySchema, req.query)));
export async function create(req, res) {
  const result = await service.createEntry(
    req.user,
    entryInput(createSchema, req.body, req.user),
    parse(keySchema, req.get('Idempotency-Key')),
  );
  res.status(result.replayed ? 200 : 201).json(result);
}
export const edit = async (req, res) =>
  res.json({
    entry: await service.editEntry(
      req.user,
      parse(idSchema, req.params.id),
      entryInput(editSchema, req.body, req.user),
    ),
  });
export const voidEntry = async (req, res) =>
  res.json({
    entry: await service.voidEntry(
      req.user,
      parse(idSchema, req.params.id),
      parse(voidSchema, req.body),
    ),
  });
export const history = async (req, res) =>
  res.json(await service.entryHistory(req.user._id, parse(idSchema, req.params.id)));
