/**
 * Health check endpoint for monitoring and load balancer probes
 */

import type { Request, Response, Router } from "express";
import { pool } from "../db";

interface HealthStatus {
  status: 'healthy' | 'unhealthy' | 'degraded';
  timestamp: string;
  uptime: number;
  checks: {
    database: {
      status: 'ok' | 'error';
      latencyMs?: number;
      error?: string;
    };
    memory: {
      status: 'ok' | 'warning';
      usedMB: number;
      totalMB: number;
      percentUsed: number;
    };
  };
}

export function registerHealthRoutes(router: Router): void {
  /**
   * Comprehensive health check endpoint
   * Returns 200 if healthy, 503 if unhealthy
   */
  router.get("/api/health", async (_req: Request, res: Response) => {
    const startTime = Date.now();
    const health: HealthStatus = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      checks: {
        database: { status: 'ok' },
        memory: { status: 'ok', usedMB: 0, totalMB: 0, percentUsed: 0 },
      },
    };

    // Check database connectivity
    try {
      const dbStart = Date.now();
      const client = await pool.connect();
      await client.query('SELECT 1');
      client.release();
      health.checks.database.latencyMs = Date.now() - dbStart;
    } catch (err) {
      health.status = 'unhealthy';
      health.checks.database.status = 'error';
      health.checks.database.error = err instanceof Error ? err.message : 'Unknown error';
    }

    // Check memory usage
    const memUsage = process.memoryUsage();
    const usedMB = Math.round(memUsage.heapUsed / 1024 / 1024);
    const totalMB = Math.round(memUsage.heapTotal / 1024 / 1024);
    const percentUsed = Math.round((usedMB / totalMB) * 100);

    health.checks.memory = {
      status: percentUsed > 90 ? 'warning' : 'ok',
      usedMB,
      totalMB,
      percentUsed,
    };

    // Degraded if memory is high but DB is OK
    if (health.checks.memory.status === 'warning' && health.status === 'healthy') {
      health.status = 'degraded';
    }

    const statusCode = health.status === 'unhealthy' ? 503 : 200;
    res.status(statusCode).json(health);
  });

  /**
   * Simple liveness probe (always returns 200 if server is running)
   */
  router.get("/api/health/live", (_req: Request, res: Response) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  /**
   * Readiness probe (returns 200 only if ready to serve traffic)
   */
  router.get("/api/health/ready", async (_req: Request, res: Response) => {
    try {
      const client = await pool.connect();
      await client.query('SELECT 1');
      client.release();
      res.json({ status: 'ready', timestamp: new Date().toISOString() });
    } catch (err) {
      res.status(503).json({
        status: 'not_ready',
        timestamp: new Date().toISOString(),
        error: err instanceof Error ? err.message : 'Database unavailable',
      });
    }
  });
}
