import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as admin from 'firebase-admin';

@Injectable()
export class NotificationsService implements OnModuleInit {
  private readonly logger = new Logger(NotificationsService.name);
  private initialized = false;

  constructor(private readonly config: ConfigService) {}

  onModuleInit() {
    const projectId = this.config.get<string>('FIREBASE_PROJECT_ID');
    const clientEmail = this.config.get<string>('FIREBASE_CLIENT_EMAIL');
    const privateKey = this.config.get<string>('FIREBASE_PRIVATE_KEY');

    if (!projectId || !clientEmail || !privateKey) {
      this.logger.warn('[FCM] Firebase credentials not set — notifications disabled');
      return;
    }

    if (!admin.apps.length) {
      admin.initializeApp({
        credential: admin.credential.cert({
          projectId,
          clientEmail,
          privateKey: privateKey.replace(/\\n/g, '\n'),
        }),
      });
    }

    this.initialized = true;
    this.logger.log('[FCM] Firebase Admin SDK initialized');
  }

  async send(
    fcmToken: string,
    notification: { title: string; body: string },
    data?: Record<string, string>,
  ): Promise<void> {
    if (!this.initialized || !fcmToken) return;

    // FCM data values must be strings; keep routing keys + title/body in data so
    // Android still delivers them when the user taps a tray notification.
    const payload: Record<string, string> = {};
    if (data) {
      for (const [key, value] of Object.entries(data)) {
        if (value == null) continue;
        payload[key] = String(value);
      }
    }
    payload.title = notification.title;
    payload.body = notification.body;

    try {
      await admin.messaging().send({
        token: fcmToken,
        notification,
        data: payload,
        android: { priority: 'high' },
        apns: {
          payload: {
            aps: {
              alert: notification,
              sound: 'default',
              badge: 1,
              contentAvailable: true,
            },
          },
        },
      });
    } catch (err: any) {
      this.logger.warn(`[FCM] Failed to send notification: ${err?.message}`);
    }
  }
}
