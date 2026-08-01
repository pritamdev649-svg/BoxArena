import type { Types } from 'mongoose';
import {
  NotificationModel,
  NotificationType,
  UserModel,
  type IUser,
} from '../../models/index.js';
import { logger } from '../../shared/config/logger.js';

/**
 * Notifications (edge_cases.md §8).
 *
 * The in-app inbox is the SOURCE OF TRUTH; FCM is best-effort transport on
 * top. A user with push disabled must still see everything in-app (§89).
 *
 * Never call this inside a transaction — `withTransaction` retries, and a
 * rolled-back transaction that already sent "You won ₹500" is unrecoverable
 * (§91).
 */

export interface NotifyInput {
  userId: Types.ObjectId;
  type: NotificationType;
  title: string;
  body: string;
  /** Deep-link payload for the mobile router. */
  data?: Record<string, string>;
}

export async function notify(input: NotifyInput): Promise<void> {
  const [notification] = await NotificationModel.create([
    {
      userId: input.userId,
      type: input.type,
      title: input.title,
      body: input.body,
      ...(input.data === undefined ? {} : { data: input.data }),
    },
  ]);

  if (!notification) return;

  /** Transport failure must never fail the caller's business operation. */
  try {
    await sendPush(input);
    notification.sentViaFcm = true;
    await notification.save();
  } catch (err) {
    logger.warn({ err, type: input.type }, 'Push delivery failed; inbox row still written');
  }
}

/**
 * Sends to every registered device.
 *
 * NEVER put amounts or OTPs in the payload — push notifications render on
 * lock screens (§90).
 */
async function sendPush(input: NotifyInput): Promise<void> {
  const user = await UserModel.findById(input.userId).select('fcmTokens notificationPrefs').lean();
  if (!user || user.fcmTokens.length === 0) return;

  /** Respect per-type opt-outs, except for money and disputes (§92). */
  const alwaysSend: NotificationType[] = [
    NotificationType.WALLET_CREDITED,
    NotificationType.WALLET_DEBITED,
    NotificationType.MATCH_DISPUTED,
    NotificationType.DISPUTE_RESOLVED,
    NotificationType.WITHDRAWAL_PROCESSED,
  ];

  const prefs = user.notificationPrefs as unknown as Map<string, boolean> | undefined;
  const optedOut = prefs instanceof Map ? prefs.get(input.type) === false : false;
  if (optedOut && !alwaysSend.includes(input.type)) return;

  const { getMessaging } = await import('../../shared/config/firebase.js');
  const messaging = getMessaging();
  if (!messaging) return;

  const tokens = user.fcmTokens.map((entry) => entry.token);
  const response = await messaging.sendEachForMulticast({
    tokens,
    notification: { title: input.title, body: input.body },
    ...(input.data === undefined ? {} : { data: input.data }),
  });

  /** Dead tokens must be pruned or the array grows forever (§87). */
  const dead: string[] = [];
  response.responses.forEach((result: { error?: { code?: string } }, index: number) => {
    const code = result.error?.code;
    if (
      code === 'messaging/registration-token-not-registered' ||
      code === 'messaging/invalid-argument'
    ) {
      const token = tokens[index];
      if (token) dead.push(token);
    }
  });

  if (dead.length > 0) {
    await UserModel.updateOne(
      { _id: input.userId },
      { $pull: { fcmTokens: { token: { $in: dead } } } },
    );
  }
}

export async function listInbox(user: IUser, limit = 30) {
  return NotificationModel.find({ userId: user._id })
    .sort({ createdAt: -1 })
    .limit(Math.min(limit, 100))
    .lean();
}

export async function unreadCount(user: IUser): Promise<number> {
  return NotificationModel.countDocuments({ userId: user._id, isRead: false });
}

export async function markRead(user: IUser, notificationId: string): Promise<void> {
  await NotificationModel.updateOne(
    { _id: notificationId, userId: user._id },
    { $set: { isRead: true, readAt: new Date() } },
  );
}

export async function markAllRead(user: IUser): Promise<number> {
  const result = await NotificationModel.updateMany(
    { userId: user._id, isRead: false },
    { $set: { isRead: true, readAt: new Date() } },
  );
  return result.modifiedCount;
}
