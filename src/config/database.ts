import pg from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import { softDeleteExtension } from './soft-delete.js';

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

// Base Prisma client instance (unextended — sees all records including soft-deleted)
const basePrisma = new PrismaClient({ adapter });

/**
 * Admin Prisma client — bypasses soft-delete filtering.
 * Use for admin/restore queries that need access to soft-deleted records.
 * NOT for general application use.
 */
export const adminPrisma = basePrisma;

/**
 * Default Prisma client with soft-delete extension applied.
 * - Read operations auto-filter `deletedAt IS NULL` on soft-deletable models
 * - Delete operations transparently convert to soft-deletes (set `deletedAt`)
 */
const prisma = basePrisma.$extends(softDeleteExtension);

export default prisma;
