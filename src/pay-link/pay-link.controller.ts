import { Controller, Get, Post, Param, Query, Body, Header, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import { PayLinkService } from './pay-link.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';

function pickLang(lang: string | undefined): 'ar' | 'en' {
  return lang === 'en' ? 'en' : 'ar';
}

@Controller('p')
export class PayLinkController {
  constructor(private readonly payLinkService: PayLinkService) {}

  @Get(':token')
  @Header('Content-Type', 'text/html; charset=utf-8')
  async getPayPage(
    @Param('token') token: string,
    @Query('lang') lang: string | undefined,
    @Res() res: Response,
  ) {
    const html = await this.payLinkService.renderPayPage(token, pickLang(lang));
    res.send(html);
  }

  @Post(':token/paid')
  @Header('Content-Type', 'text/html; charset=utf-8')
  async markPaid(
    @Param('token') token: string,
    @Body() body: { method?: string; lang?: string },
    @Query('lang') lang: string | undefined,
    @Res() res: Response,
  ) {
    const method = body?.method === 'instapay' ? 'instapay' : 'cash';
    const html = await this.payLinkService.markPaid(token, method, pickLang(body?.lang ?? lang));
    res.send(html);
  }
}

@Controller('s')
export class LegacyPayLinkController {
  constructor(private readonly payLinkService: PayLinkService) {}

  @Get(':shareId')
  @Header('Content-Type', 'text/html; charset=utf-8')
  async getPayPage(
    @Param('shareId') shareId: string,
    @Query('lang') lang: string | undefined,
    @Res() res: Response,
  ) {
    const html = await this.payLinkService.renderByShareId(shareId, pickLang(lang));
    res.send(html);
  }
}

@Controller('shares')
@UseGuards(JwtAuthGuard)
export class SharePayLinkController {
  constructor(private readonly payLinkService: PayLinkService) {}

  @Post(':id/pay-link')
  issue(@Param('id') id: string, @CurrentUser() user: any) {
    return this.payLinkService.issue(id, user.id);
  }
}
