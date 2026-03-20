import { db } from "../db";
import { serviceChangeRequests, type InsertServiceChangeRequest, type ServiceChangeRequest } from "@shared/schema";
import { eq, and, desc, sql, type SQL } from "drizzle-orm";

export class ReviewStorage {
  async createChangeRequest(data: InsertServiceChangeRequest): Promise<ServiceChangeRequest> {
    const [created] = await db.insert(serviceChangeRequests).values(data).returning();
    return created;
  }

  async getChangeRequests(params: {
    status?: string;
    source?: string;
    changeType?: string;
    batchId?: string;
    page?: number;
    limit?: number;
  }): Promise<{ requests: ServiceChangeRequest[]; total: number }> {
    const page = params.page ?? 1;
    const limit = params.limit ?? 500;
    const offset = (page - 1) * limit;

    const conditions: SQL[] = [];

    if (params.status) {
      conditions.push(eq(serviceChangeRequests.status, params.status));
    }
    if (params.source) {
      conditions.push(eq(serviceChangeRequests.source, params.source));
    }
    if (params.changeType) {
      conditions.push(eq(serviceChangeRequests.changeType, params.changeType));
    }
    if (params.batchId) {
      conditions.push(eq(serviceChangeRequests.batchId, params.batchId));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const [countResult, dataResult] = await Promise.all([
      db.select({ count: sql<number>`count(*)` }).from(serviceChangeRequests).where(whereClause),
      db.select().from(serviceChangeRequests).where(whereClause)
        .orderBy(desc(serviceChangeRequests.submittedAt))
        .limit(limit).offset(offset),
    ]);

    return {
      requests: dataResult,
      total: Number(countResult[0]?.count ?? 0),
    };
  }

  async getChangeRequestById(id: number): Promise<ServiceChangeRequest | null> {
    const [req] = await db.select().from(serviceChangeRequests).where(eq(serviceChangeRequests.id, id));
    return req ?? null;
  }

  async updateChangeRequest(id: number, changes: Partial<ServiceChangeRequest>): Promise<ServiceChangeRequest> {
    const [updated] = await db.update(serviceChangeRequests)
      .set(changes)
      .where(eq(serviceChangeRequests.id, id))
      .returning();
    if (!updated) throw new Error(`Change request with id ${id} not found`);
    return updated;
  }

  async rejectChangeRequest(id: number, reason: string, reviewedBy?: string): Promise<void> {
    const req = await this.getChangeRequestById(id);
    if (!req) throw new Error(`Change request with id ${id} not found`);

    await this.updateChangeRequest(id, {
      status: 'rejected',
      reviewNotes: reason,
      reviewedAt: new Date(),
      reviewedBy: reviewedBy ?? 'admin',
    });
  }
}
