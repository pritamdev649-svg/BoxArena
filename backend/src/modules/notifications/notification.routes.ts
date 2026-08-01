import { Router } from 'express';
import { authenticate, currentUser } from '../../shared/middlewares/auth.js';
import { ok } from '../../shared/utils/response.js';
import * as service from './notification.service.js';

export const notificationRoutes = Router();
notificationRoutes.use(authenticate);

notificationRoutes.get('/', async (req, res, next) => {
  try {
    const user = currentUser(req);
    const [items, unread] = await Promise.all([
      service.listInbox(user, Number(req.query.limit ?? 30)),
      service.unreadCount(user),
    ]);
    ok(res, { items, unread });
  } catch (err) {
    next(err);
  }
});

notificationRoutes.post('/:id/read', async (req, res, next) => {
  try {
    await service.markRead(currentUser(req), String(req.params.id));
    ok(res, { read: true });
  } catch (err) {
    next(err);
  }
});

notificationRoutes.post('/read-all', async (req, res, next) => {
  try {
    ok(res, { marked: await service.markAllRead(currentUser(req)) });
  } catch (err) {
    next(err);
  }
});
