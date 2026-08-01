import { Router } from 'express';
import { z } from 'zod';
import { authenticate } from '../../shared/middlewares/auth.js';
import { validate, validatedQuery } from '../../shared/middlewares/validate.js';
import { ok } from '../../shared/utils/response.js';
import * as service from './geo.service.js';

export const geoRoutes = Router();

// Geocoding endpoints require authentication
geoRoutes.use(authenticate);

const autocompleteSchema = z
  .object({
    q: z.string().min(1),
  })
  .strict();

const reverseSchema = z
  .object({
    lat: z.coerce.number().min(-90).max(90),
    lng: z.coerce.number().min(-180).max(180),
  })
  .strict();

geoRoutes.get('/autocomplete', validate({ query: autocompleteSchema }), async (req, res, next) => {
  try {
    const { q } = validatedQuery<z.infer<typeof autocompleteSchema>>(req);
    const predictions = await service.autocomplete(q);
    ok(res, predictions);
  } catch (err) {
    next(err);
  }
});

geoRoutes.get('/reverse', validate({ query: reverseSchema }), async (req, res, next) => {
  try {
    const { lat, lng } = validatedQuery<z.infer<typeof reverseSchema>>(req);
    const result = await service.reverseGeocode(lat, lng);
    ok(res, result);
  } catch (err) {
    next(err);
  }
});
