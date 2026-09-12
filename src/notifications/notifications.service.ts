import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { FirebaseAdminService } from '../firebase/firebase-admin.service';
import { User } from '../users/entities/user.entity';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private readonly firebase: FirebaseAdminService,
    @InjectRepository(User)
    private readonly usersRepo: Repository<User>,
  ) {}

  async send(
    fcmToken: string,
    notification: { title: string; body: string },
    data?: Record<string, string>,
  ): Promise<void> {
    if (!fcmToken) return;
    if (!this.firebase.isReady) {
      this.logger.warn('[FCM] Skip send — Firebase Admin is not configured');
      return;
    }

    // APNs badge is an absolute count, not +1. Always sending 1 is why the
    // home-screen icon never moved past a single dot.
    const badge = await this.incrementBadge(fcmToken);

    const payload: Record<string, string> = {};
    if (data) {
      for (const [key, value] of Object.entries(data)) {
        if (value == null) continue;
        payload[key] = String(value);
      }
    }
    payload.title = notification.title;
    payload.body = notification.body;
    payload.badge = String(badge);

    try {
      await this.firebase.messaging().send({
        token: fcmToken,
        notification,
        data: payload,
        android: {
          priority: 'high',
          notification: {
            channelId: 'plusone_alerts',
            sound: 'default',
            notificationCount: badge,
          },
        },
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
              badge,
            },
          },
        },
      });
    } catch (err: any) {
      const code = err?.errorInfo?.code ?? err?.code;
      this.logger.warn(`[FCM] Failed to send notification: ${code ?? ''} ${err?.message}`);
      if (
        code === 'messaging/registration-token-not-registered' ||
        code === 'messaging/invalid-registration-token'
      ) {
        await this.usersRepo
          .createQueryBuilder()
          .update(User)
          .set({ fcmToken: () => 'NULL' })
          .where('fcmToken = :token', { token: fcmToken })
          .execute()
          .catch(() => {});
      }
    }
  }

  private async incrementBadge(fcmToken: string): Promise<number> {
    try {
      await this.usersRepo
        .createQueryBuilder()
        .update(User)
        .set({ unreadBadgeCount: () => 'unreadBadgeCount + 1' })
        .where('fcmToken = :token', { token: fcmToken })
        .execute();
      const row = await this.usersRepo.findOne({
        where: { fcmToken },
        select: { unreadBadgeCount: true },
      });
      return Math.max(1, row?.unreadBadgeCount ?? 1);
    } catch (err: any) {
      this.logger.warn(`[FCM] Badge increment failed: ${err?.message}`);
      return 1;
    }
  }
}
