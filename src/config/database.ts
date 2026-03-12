import pg from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';

// Create PostgreSQL connection pool with proper configuration
const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  max: 20, // Maximum number of clients in the pool
  idleTimeoutMillis: 30000, // Close idle clients after 30 seconds
  connectionTimeoutMillis: 10000, // Wait 10 seconds before timing out when connecting a new client
  allowExitOnIdle: true, // Allow the pool to close all idle clients when node process is idle
});

// Create Prisma adapter
const adapter = new PrismaPg(pool);

// Singleton Prisma client instance with pg adapter
const prisma = new PrismaClient({ adapter });

export default prisma;
