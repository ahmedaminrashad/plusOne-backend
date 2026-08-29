import { Controller, Get, Header, Param, Req, Res } from '@nestjs/common';
import type { Request, Response } from 'express';
import { InviteLinksService } from './invite-links.service';

const PLAY = 'https://play.google.com/store/apps/details?id=com.plusone';
const APP_STORE = 'https://apps.apple.com/app/plusone/id0000000000';
const SITE = 'https://plusone-app.com';

@Controller('i')
export class InviteLandingController {
  constructor(private readonly invites: InviteLinksService) {}

  @Get(':token')
  @Header('Content-Type', 'text/html; charset=utf-8')
  async land(@Param('token') token: string, @Req() req: Request, @Res() res: Response) {
    const link = await this.invites.findByToken(token);
    const ua = String(req.headers['user-agent'] ?? '');
    const isIos = /iPhone|iPad|iPod/i.test(ua);
    const isAndroid = /Android/i.test(ua);
    const isMobile = isIos || isAndroid;

    if (!link) {
      res.status(404).send(landingHtml({
        title: '+one',
        heading: 'This invite is no longer valid',
        sub: 'Ask your friend to send a new one.',
      }));
      return;
    }

    if (isIos) {
      res.redirect(302, APP_STORE);
      return;
    }
    if (isAndroid) {
      res.redirect(302, PLAY);
      return;
    }

    res.send(landingHtml({
      title: 'Get +one',
      heading: "You've been invited to +one",
      sub: 'Split bills with friends. Download the app to claim this invite after you sign up with the same phone number.',
      showBadges: !isMobile,
    }));
  }
}

function landingHtml(opts: { title: string; heading: string; sub: string; showBadges?: boolean }): string {
  const badges = opts.showBadges
    ? `<div class="badges">
        <a href="${PLAY}">Google Play</a>
        <a href="${APP_STORE}">App Store</a>
      </div>`
    : '';
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<meta property="og:title" content="You're invited to +one"/>
<meta property="og:description" content="Split bills with friends — get the app."/>
<meta property="og:url" content="${SITE}"/>
<title>${opts.title}</title>
<style>
  body { margin:0; min-height:100vh; display:flex; align-items:center; justify-content:center;
    font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif; background:#F4F3EF; color:#182320; padding:24px; }
  .card { max-width:420px; width:100%; background:#fff; border-radius:20px; padding:28px; text-align:center;
    box-shadow:0 4px 20px rgba(0,0,0,.06); }
  .brand { color:#14665D; font-weight:800; font-size:22px; margin-bottom:12px; }
  h1 { font-size:20px; margin:0 0 8px; }
  p { color:#66706B; line-height:1.5; }
  .badges { display:flex; gap:12px; justify-content:center; margin-top:20px; }
  .badges a { background:#14665D; color:#fff; text-decoration:none; padding:12px 16px; border-radius:999px; font-weight:700; font-size:14px; }
</style>
</head>
<body>
  <div class="card">
    <div class="brand">+one</div>
    <h1>${opts.heading}</h1>
    <p>${opts.sub}</p>
    ${badges}
  </div>
</body>
</html>`;
}
