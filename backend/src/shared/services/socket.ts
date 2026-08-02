import { WebSocket, WebSocketServer } from 'ws';
import type { IncomingMessage, Server } from 'http';
import { verifyAccessToken } from '../../modules/auth/auth.service.js';
import { UserModel } from '../../models/index.js';
import { logger } from '../config/logger.js';
import crypto from 'crypto';

// Maps userId to a Set of WebSocket connections
const connections = new Map<string, Set<WebSocket>>();

// Outstanding acks to track: maps messageId to a resolve callback
const pendingAcks = new Map<string, () => void>();

export function initWebSocketServer(server: Server) {
  const wss = new WebSocketServer({ noServer: true });

  server.on('upgrade', async (request: IncomingMessage, socket, head) => {
    try {
      const url = new URL(request.url || '', `http://${request.headers.host}`);
      const token = url.searchParams.get('token');
      if (!token) {
        socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
        socket.destroy();
        return;
      }

      const claims = verifyAccessToken(token);
      const user = await UserModel.findById(claims.sub);
      if (!user) {
        socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
        socket.destroy();
        return;
      }

      wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit('connection', ws, request, user._id.toString());
      });
    } catch (err) {
      logger.error({ err }, 'WS upgrade authentication failed');
      socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
      socket.destroy();
    }
  });

  wss.on('connection', (ws: WebSocket, _request: IncomingMessage, userId: string) => {
    logger.info({ userId }, 'WebSocket client connected');

    let userSockets = connections.get(userId);
    if (!userSockets) {
      userSockets = new Set();
      connections.set(userId, userSockets);
    }
    userSockets.add(ws);

    ws.on('message', (messageBuffer) => {
      try {
        const message = JSON.parse(messageBuffer.toString());
        if (message.type === 'ack' && typeof message.messageId === 'string') {
          const resolve = pendingAcks.get(message.messageId);
          if (resolve) {
            logger.info({ userId, messageId: message.messageId }, 'WebSocket message acknowledged by client');
            resolve();
            pendingAcks.delete(message.messageId);
          }
        }
      } catch (err) {
        logger.error({ err }, 'Error parsing WS message from client');
      }
    });

    ws.on('close', () => {
      logger.info({ userId }, 'WebSocket client disconnected');
      userSockets?.delete(ws);
      if (userSockets?.size === 0) {
        connections.delete(userId);
      }
    });

    ws.on('error', (err) => {
      logger.error({ err, userId }, 'WebSocket error');
    });
  });
}

/**
 * Sends a message to a specific user via all their open sockets and waits for acknowledgement.
 * Replicates a Request-Response model over WebSockets.
 */
export function sendToUserWithAck(
  userId: string,
  type: string,
  data: any,
  timeoutMs = 10000,
): Promise<boolean> {
  const userSockets = connections.get(userId);
  if (!userSockets || userSockets.size === 0) {
    logger.warn({ userId }, 'No active WS connection found for user to send message');
    return Promise.resolve(false);
  }

  const messageId = `msg_${crypto.randomUUID()}`;
  const payload = JSON.stringify({
    type,
    messageId,
    data,
  });

  logger.info({ userId, messageId, type }, 'Sending WebSocket message to user, waiting for ack');

  // Send to all open sockets for the user
  for (const socket of userSockets) {
    if (socket.readyState === WebSocket.OPEN) {
      socket.send(payload);
    }
  }

  return new Promise<boolean>((resolve) => {
    const timer = setTimeout(() => {
      if (pendingAcks.has(messageId)) {
        logger.warn({ userId, messageId }, 'WebSocket message acknowledgement timed out');
        pendingAcks.delete(messageId);
        resolve(false);
      }
    }, timeoutMs);

    pendingAcks.set(messageId, () => {
      clearTimeout(timer);
      resolve(true);
    });
  });
}

/**
 * Fire-and-forget broadcast to several users.
 *
 * Deliberately unacked, unlike `sendToUserWithAck`: a live score frame is
 * superseded by the next one within seconds, so retrying a dropped frame is
 * worse than letting it go — the client would render a stale score after a
 * fresher one had already arrived.
 */
export function broadcastToUsers(userIds: string[], type: string, data: unknown): void {
  const payload = JSON.stringify({ type, data });

  for (const userId of new Set(userIds)) {
    const sockets = connections.get(userId);
    if (!sockets) continue;

    for (const socket of sockets) {
      if (socket.readyState === WebSocket.OPEN) socket.send(payload);
    }
  }
}
