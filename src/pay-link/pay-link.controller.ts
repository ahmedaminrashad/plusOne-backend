import { Controller, Get, Param, Query, Header, Res } from '@nestjs/common';
import type { Response } from 'express';
import { PayLinkService } from './pay-link.service';

// Deliberately outside the JwtAuthGuard / api/v1 prefix (see main.ts) — this is
// the page a "+1" without the app opens from an SMS pay-link, so it can't
// require login.
@Controller('s')
export class PayLinkController {
  constructor(private readonly payLinkService: PayLinkService) {}

  @Get(':shareId')
  @Header('Content-Type', 'text/html; charset=utf-8')
  async getPayPage(
    @Param('shareId') shareId: string,
    @Query('lang') lang: string | undefined,
    @Res() res: Response,
  ) {
    const html = await this.payLinkService.renderPayPage(shareId, lang === 'en' ? 'en' : 'ar');
    res.send(html);
  }
}
