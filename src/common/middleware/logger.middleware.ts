import { Injectable, NestMiddleware, Logger } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

@Injectable()
export class LoggerMiddleware implements NestMiddleware {
  private readonly logger = new Logger('HTTP');

  use(req: Request, res: Response, next: NextFunction) {
    const { method, originalUrl } = req;
    const start = Date.now();

    res.on('finish', () => {
      const ms = Date.now() - start;
      const { statusCode } = res;
      const color = statusCode >= 500 ? 31 : statusCode >= 400 ? 33 : statusCode >= 300 ? 36 : 32;
      this.logger.log(`\x1b[${color}m${statusCode}\x1b[0m ${method} ${originalUrl} — ${ms}ms`);
    });

    next();
  }
}
