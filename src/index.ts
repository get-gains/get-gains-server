import 'dotenv/config';
import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import { logPath } from './utils/console-message';
import { logger } from './utils/logger';
import dotenv from 'dotenv';
import authRoutes from './routes/auth.routes';
import workoutRoutes from './routes/workout.routes';
import subscriptionRoutes from './routes/subscription.routes';
import webhookRoutes from './routes/webhook.routes';
import promoRoutes from './routes/promo.routes';
import coachRoutes from './routes/coach.routes';
import userRoutes from './routes/user.routes';
import poseRoutes from './routes/pose.routes';

dotenv.config();

const startServer = () => {
  const app = express();
  const PORT = process.env.PORT || 3000;

  // Middleware
  app.use(cors());
  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ extended: true, limit: '50mb' }));

  app.use((req: Request, res: Response, next: NextFunction) => {
    logPath(req.method, req.path, res.statusCode);
    next();
  });

  // Routes
  app.get('/', (req: Request, res: Response) => {
    res.json({ message: 'Hello from TypeScript Express!' });
  });

  app.get('/health', (req: Request, res: Response) => {
    res.json({ status: 'OK', timestamp: new Date().toISOString() });
  });

  // API Routes
  app.use('/api/auth', authRoutes);
  app.use('/api/workout', workoutRoutes);
  app.use('/api/subscriptions', subscriptionRoutes);
  app.use('/api/webhooks', webhookRoutes);
  app.use('/api/promo', promoRoutes);
  app.use('/api/coach', coachRoutes);
  app.use('/api/user', userRoutes);
  app.use('/api/pose', poseRoutes);
  app.use('/api/users', userRoutes);

  // 404 Handler (contract: data + errors envelope)
  app.use((req: Request, res: Response) => {
    logger.warn(`Route not found: ${req.method} ${req.path}`);
    res.status(404).json({
      data: null,
      errors: [{ message: 'Route not found' }],
    });
  });

  // Error Handler (contract: data + errors envelope)
  app.use((err: Error, req: Request, res: Response) => {
    logger.error('Unhandled error:', err);
    res.status(500).json({
      data: null,
      errors: [{ message: 'Something went wrong!' }],
    });
  });

  app.listen(PORT, () => {
    logger.info(`Server is running on http://localhost:${PORT}`);
  });
};

startServer();
