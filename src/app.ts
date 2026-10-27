import express, { Express, Request, Response, NextFunction } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import swaggerUi from 'swagger-ui-express';
import openApiDocument from './docs/openapi.json';
import { env } from './config/env';
import { logger } from './utils/logger';
import routes from './routes';
import { errorHandler } from './middleware/error.middleware';
import { ipRateLimiter } from './middleware/rateLimiter.middleware';

export function createApp(): Express {
  const app = express();

  // Security headers (allow inline styles for swagger UI if on /docs)
  app.use(
    helmet({
      contentSecurityPolicy: false
    })
  );

  // CORS configuration from environment
  const corsOrigins = env.CORS_ORIGIN.includes(',')
    ? env.CORS_ORIGIN.split(',').map((o) => o.trim())
    : env.CORS_ORIGIN;

  app.use(
    cors({
      origin: corsOrigins === '*' ? true : corsOrigins,
      credentials: true
    })
  );

  // Body parsing
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true }));

  // Global IP-based rate limiting
  app.use(ipRateLimiter());

  // Swagger Documentation
  app.use('/docs', swaggerUi.serve, swaggerUi.setup(openApiDocument));

  // Request logging
  if (env.NODE_ENV !== 'test') {
    app.use((req: Request, res: Response, next: NextFunction) => {
      const start = Date.now();
      res.on('finish', () => {
        logger.info(
          {
            method: req.method,
            path: req.originalUrl,
            status: res.statusCode,
            durationMs: Date.now() - start
          },
          'HTTP Request'
        );
      });
      next();
    });
  }

  // Application Routes
  app.use('/', routes);

  // 404 Not Found fallback
  app.use((req: Request, res: Response) => {
    res.status(404).json({ error: `Route not found: ${req.method} ${req.originalUrl}` });
  });

  // Central error handling middleware
  app.use(errorHandler);

  return app;
}

export const app = createApp();
