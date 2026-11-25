import {
  CallHandler,
  ExecutionContext,
  Injectable,
  Logger,
  NestInterceptor,
} from '@nestjs/common';
import type { Response } from 'express';
import { Observable } from 'rxjs';
import { finalize } from 'rxjs/operators';
import type { RequestWithId } from './request-id.middleware';

@Injectable()
export class HttpTimingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'http') {
      return next.handle();
    }

    const http = context.switchToHttp();
    const req = http.getRequest<RequestWithId>();
    const res = http.getResponse<Response>();
    const path = (req.originalUrl ?? req.url ?? '').split('?')[0] || '/';

    // Docker / probes hit these every few seconds — skip noise.
    if (path === '/api/health' || path === '/api/health/ready') {
      return next.handle();
    }

    const started = Date.now();
    return next.handle().pipe(
      finalize(() => {
        const durationMs = Date.now() - started;
        const userId =
          (req as RequestWithId & { user?: { id?: string } }).user?.id ?? '-';
        this.logger.log(
          `method=${req.method} path=${path} status=${res.statusCode} durationMs=${durationMs} requestId=${req.requestId ?? '-'} userId=${userId}`,
        );
      }),
    );
  }
}
