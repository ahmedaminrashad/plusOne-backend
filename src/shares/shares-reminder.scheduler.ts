import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { SharesService } from './shares.service';

@Injectable()
export class SharesReminderScheduler {
  private readonly logger = new Logger(SharesReminderScheduler.name);

  constructor(private readonly sharesService: SharesService) {}

  @Cron(CronExpression.EVERY_HOUR)
  async nudgeStaleInitiatedShares(): Promise<void> {
    const stale = await this.sharesService.findStaleInitiatedShares();
    for (const share of stale) {
      try {
        await this.sharesService.sendStaleInitiatedNudge(share);
      } catch (err: any) {
        this.logger.warn(`Failed to nudge share ${share.id}: ${err?.message}`);
      }
    }
    if (stale.length > 0) {
      this.logger.log(`[REMINDER-JOB] Nudged ${stale.length} stale initiated share(s)`);
    }
  }
}
