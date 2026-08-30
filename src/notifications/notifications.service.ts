import { Injectable, Logger } from '@nestjs/common';
import { FirebaseAdminService } from '../firebase/firebase-admin.service';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(private readonly firebase: FirebaseAdminService) {}

  async send(
    fcmToken: string,
    notification: { title: string; body: string },
    data?: Record<string, string>,
  ): Promise<void> {
    if (!this.firebase.isReady || !fcmToken) return;

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
      await this.firebase.messaging().send({
        token: fcmToken,
        notification,
        data: payload,
        android: { priority: 'high' },
        apns: {
          headers: {
            'apns-priority': '10',
            'apns-push-type': 'alert',
          },
          payload: {
            aps: {
              alert: {
                title: notification.title,
                body: notification.body,
              },
              sound: 'default',
              badge: 1,
            },
          },
        },
      });
    } catch (err: any) {
      this.logger.warn(`[FCM] Failed to send notification: ${err?.message}`);
    }
  }
}
