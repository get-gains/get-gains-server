import 'dotenv/config';
import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import { logPath } from './utils/console-message';
import { logger } from './utils/logger';
import dotenv from 'dotenv';
import authRoutes from './routes/auth.routes';
import workoutRoutes from './routes/workout.routes';

dotenv.config();

const startServer = () => {
  const app = express();
  const PORT = process.env.PORT || 3000;

  // Middleware
  app.use(cors());
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

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

  // 404 Handler
  app.use((req: Request, res: Response) => {
    logger.warn(`Route not found: ${req.method} ${req.path}`);
    res.status(404).json({ error: 'Route not found' });
  });

  // Error Handler - Must have 4 parameters including 'next'
  app.use((err: Error, req: Request, res: Response) => {
    logger.error('Unhandled error:', err);
    res.status(500).json({ error: 'Something went wrong!' });
  });

  app.listen(PORT, () => {
    logger.info(`Server is running on http://localhost:${PORT}`);
  });
};

startServer();
