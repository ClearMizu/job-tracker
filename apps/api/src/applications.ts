import { and, count, desc, eq } from "drizzle-orm";
import { Elysia, t } from "elysia";
import type { AuthPlugin } from "./auth";
import type { Db } from "./db";
import { jobApplication, jobApplicationStatusHistory } from "./db/schema";

const MAX_NOTES = 2000;
const NonBlank = { minLength: 1, maxLength: 200, pattern: "\\S" };
const UrlString = {
  maxLength: 2048,
  pattern: "^[hH][tT][tT][pP][sS]?://[^\\s]+$",
};

// UnionEnum injects a default (first value), which breaks optional fields.
const Status = t.Union([
  t.Literal("saved"),
  t.Literal("applied"),
  t.Literal("interview"),
  t.Literal("offer"),
  t.Literal("rejected"),
]);
const IdParams = t.Object({ id: t.String({ minLength: 1, maxLength: 64 }) });
const ErrorBody = t.Object({ error: t.String() });

const HistoryItem = t.Object({
  id: t.String(),
  fromStatus: t.Union([Status, t.Null()]),
  toStatus: Status,
  changedAt: t.String(),
});

const ApplicationBody = t.Object({
  id: t.String(),
  company: t.String(),
  role: t.String(),
  url: t.Union([t.String(), t.Null()]),
  status: Status,
  notes: t.Union([t.String(), t.Null()]),
  appliedAt: t.Union([t.String(), t.Null()]),
  createdAt: t.String(),
  updatedAt: t.String(),
});

const ApplicationWithHistory = t.Composite([
  ApplicationBody,
  t.Object({ history: t.Array(HistoryItem) }),
]);

type ApplicationRow = typeof jobApplication.$inferSelect;
type HistoryRow = typeof jobApplicationStatusHistory.$inferSelect;

const serialize = (row: ApplicationRow) => ({
  id: row.id,
  company: row.company,
  role: row.role,
  url: row.url,
  status: row.status,
  notes: row.notes,
  appliedAt: row.appliedAt?.toISOString() ?? null,
  createdAt: row.createdAt.toISOString(),
  updatedAt: row.updatedAt.toISOString(),
});

const serializeHistory = (row: HistoryRow) => ({
  id: row.id,
  fromStatus: row.fromStatus,
  toStatus: row.toStatus,
  changedAt: row.changedAt.toISOString(),
});

function isHttpUrl(value: string): boolean {
  try {
    const { protocol } = new URL(value);
    return protocol === "http:" || protocol === "https:";
  } catch {
    return false;
  }
}

const parseDate = (value: string): Date | null => {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

export function applicationRoutes(db: Db, authRoutes: AuthPlugin) {
  const owned = (userId: string, id: string) =>
    and(eq(jobApplication.id, id), eq(jobApplication.userId, userId));

  const loadHistory = (userId: string, id: string) =>
    db
      .select()
      .from(jobApplicationStatusHistory)
      .where(
        and(
          eq(jobApplicationStatusHistory.applicationId, id),
          eq(jobApplicationStatusHistory.userId, userId),
        ),
      )
      .orderBy(jobApplicationStatusHistory.changedAt)
      .all()
      .map(serializeHistory);

  return new Elysia({ prefix: "/applications" })
    .use(authRoutes)
    .get(
      "/",
      ({ user, query }) => {
        const page = query.page ?? 1;
        const pageSize = query.pageSize ?? 20;
        const where = query.status
          ? and(
              eq(jobApplication.userId, user.id),
              eq(jobApplication.status, query.status),
            )
          : eq(jobApplication.userId, user.id);
        const total =
          db.select({ n: count() }).from(jobApplication).where(where).get()
            ?.n ?? 0;
        const items = db
          .select()
          .from(jobApplication)
          .where(where)
          .orderBy(desc(jobApplication.createdAt), desc(jobApplication.id))
          .limit(pageSize)
          .offset((page - 1) * pageSize)
          .all()
          .map(serialize);
        return { items, page, pageSize, total };
      },
      {
        auth: true,
        query: t.Object({
          status: t.Optional(Status),
          page: t.Optional(t.Numeric({ minimum: 1, maximum: 100000 })),
          pageSize: t.Optional(t.Numeric({ minimum: 1, maximum: 100 })),
        }),
        response: {
          200: t.Object({
            items: t.Array(ApplicationBody),
            page: t.Number(),
            pageSize: t.Number(),
            total: t.Number(),
          }),
          401: ErrorBody,
        },
      },
    )
    .post(
      "/",
      ({ user, body, status }) => {
        if (body.url && !isHttpUrl(body.url)) {
          return status(422, { error: "Invalid request" });
        }
        const appliedAt = body.appliedAt ? parseDate(body.appliedAt) : null;
        if (body.appliedAt && !appliedAt) {
          return status(422, { error: "Invalid request" });
        }
        const now = new Date();
        const initial = body.status ?? "saved";
        const row = db.transaction((tx) => {
          const created = tx
            .insert(jobApplication)
            .values({
              id: crypto.randomUUID(),
              userId: user.id,
              company: body.company.trim(),
              role: body.role.trim(),
              url: body.url ?? null,
              status: initial,
              notes: body.notes ?? null,
              appliedAt,
              createdAt: now,
              updatedAt: now,
            })
            .returning()
            .get();
          tx.insert(jobApplicationStatusHistory)
            .values({
              id: crypto.randomUUID(),
              applicationId: created.id,
              userId: user.id,
              fromStatus: null,
              toStatus: initial,
              changedAt: now,
            })
            .run();
          return created;
        });
        return status(201, serialize(row));
      },
      {
        auth: true,
        body: t.Object({
          company: t.String(NonBlank),
          role: t.String(NonBlank),
          url: t.Optional(t.String(UrlString)),
          status: t.Optional(Status),
          notes: t.Optional(t.String({ maxLength: MAX_NOTES })),
          appliedAt: t.Optional(t.String({ format: "date-time" })),
        }),
        response: {
          201: ApplicationBody,
          401: ErrorBody,
          422: ErrorBody,
        },
      },
    )
    .get(
      "/:id",
      ({ user, params, status }) => {
        const row = db
          .select()
          .from(jobApplication)
          .where(owned(user.id, params.id))
          .get();
        if (!row) return status(404, { error: "Not found" });
        return { ...serialize(row), history: loadHistory(user.id, row.id) };
      },
      {
        auth: true,
        params: IdParams,
        response: {
          200: ApplicationWithHistory,
          401: ErrorBody,
          404: ErrorBody,
        },
      },
    )
    .patch(
      "/:id",
      ({ user, params, body, status }) => {
        if (body.url && !isHttpUrl(body.url)) {
          return status(422, { error: "Invalid request" });
        }
        let appliedAt: Date | null | undefined;
        if (body.appliedAt !== undefined) {
          appliedAt =
            body.appliedAt === null ? null : parseDate(body.appliedAt);
          if (appliedAt === null && body.appliedAt !== null) {
            return status(422, { error: "Invalid request" });
          }
        }
        const now = new Date();
        const updated = db.transaction((tx) => {
          const current = tx
            .select()
            .from(jobApplication)
            .where(owned(user.id, params.id))
            .get();
          if (!current) return null;
          const row = tx
            .update(jobApplication)
            .set({
              ...(body.company !== undefined && {
                company: body.company.trim(),
              }),
              ...(body.role !== undefined && { role: body.role.trim() }),
              ...(body.url !== undefined && { url: body.url }),
              ...(body.status !== undefined && { status: body.status }),
              ...(body.notes !== undefined && { notes: body.notes }),
              ...(appliedAt !== undefined && { appliedAt }),
              updatedAt: now,
            })
            .where(owned(user.id, params.id))
            .returning()
            .get();
          if (body.status !== undefined && body.status !== current.status) {
            tx.insert(jobApplicationStatusHistory)
              .values({
                id: crypto.randomUUID(),
                applicationId: current.id,
                userId: user.id,
                fromStatus: current.status,
                toStatus: body.status,
                changedAt: now,
              })
              .run();
          }
          return row;
        });
        if (!updated) return status(404, { error: "Not found" });
        return serialize(updated);
      },
      {
        auth: true,
        params: IdParams,
        body: t.Object(
          {
            company: t.Optional(t.String(NonBlank)),
            role: t.Optional(t.String(NonBlank)),
            url: t.Optional(t.Union([t.String(UrlString), t.Null()])),
            status: t.Optional(Status),
            notes: t.Optional(
              t.Union([t.String({ maxLength: MAX_NOTES }), t.Null()]),
            ),
            appliedAt: t.Optional(
              t.Union([t.String({ format: "date-time" }), t.Null()]),
            ),
          },
          { minProperties: 1 },
        ),
        response: {
          200: ApplicationBody,
          401: ErrorBody,
          404: ErrorBody,
          422: ErrorBody,
        },
      },
    )
    .delete(
      "/:id",
      ({ user, params, status }) => {
        const removed = db
          .delete(jobApplication)
          .where(owned(user.id, params.id))
          .returning({ id: jobApplication.id })
          .get();
        if (!removed) return status(404, { error: "Not found" });
        return status(204, undefined);
      },
      {
        auth: true,
        params: IdParams,
        response: { 204: t.Undefined(), 401: ErrorBody, 404: ErrorBody },
      },
    );
}
