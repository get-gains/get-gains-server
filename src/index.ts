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
import coachRoutes from './routes/coach.routes';
import userRoutes from './routes/user.routes';
import profileRoutes from './routes/profile.routes';
import poseRoutes from './routes/pose.routes';
import standaloneRoutes from './routes/standalone.routes';
import statsRoutes from './routes/stats.routes';
import sessionsRoutes from './routes/sessions.routes';
import coinsRoutes from './routes/coins.routes';
import shopRoutes from './routes/shop.routes';
import cosmeticsRoutes from './routes/cosmetics.routes';
import leaderboardRoutes from './routes/leaderboard.routes';
import todayRoutes from './routes/today.routes';

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
  app.use('/api/coach', coachRoutes);
  app.use('/api/user', userRoutes);
  app.use('/api/profile', profileRoutes);
  app.use('/api/pose', poseRoutes);
  app.use('/api/standalone', standaloneRoutes);
  app.use('/api/stats', statsRoutes);
  app.use('/api/sessions', sessionsRoutes);
  app.use('/api/coins', coinsRoutes);
  app.use('/api/shop', shopRoutes);
  app.use('/api/cosmetics', cosmeticsRoutes);
  app.use('/api/leaderboard', leaderboardRoutes);
  app.use('/api/today', todayRoutes);
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
