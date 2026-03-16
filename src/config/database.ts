import pg from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';

// Create PostgreSQL connection pool with proper configuration
const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  max: 20, // Maximum number of clients in the pool
  idleTimeoutMillis: 60000, // Close idle clients after 60 seconds
  connectionTimeoutMillis: 30000, // Pose form inserts are heavy; wait up to 30 s for a connection
  statement_timeout: 120000, // Kill runaway queries after 2 minutes
  allowExitOnIdle: true, // Allow the pool to close all idle clients when node process is idle
});

// Create Prisma adapter
const adapter = new PrismaPg(pool);

// Singleton Prisma client instance with pg adapter
const prisma = new PrismaClient({ adapter });

export default prisma;
