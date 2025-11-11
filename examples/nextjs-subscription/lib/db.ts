import { sql } from '@vercel/postgres';

export type OrderStatus = 'pending' | 'paid' | 'expired';

export type OrderRecord = {
  id: string;
  email: string;
  planId: string;
  amount: number;
  currency: string;
  tutorialUrl: string;
  status: OrderStatus;
  tradeNo?: string;
  qrCode?: string;
  gatewayPayload?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
};

type StorageDriver = {
  create(order: OrderRecord): Promise<void>;
  update(id: string, updates: Partial<OrderRecord>): Promise<OrderRecord | null>;
  findByEmail(email: string): Promise<OrderRecord[]>;
  findById(id: string): Promise<OrderRecord | null>;
};

const inMemoryStore = new Map<string, OrderRecord>();
let inMemoryInitialized = false;

let driver: StorageDriver | null = null;
let ensured = false;

const POSTGRES_ENABLED = Boolean(
  process.env.POSTGRES_URL ||
    process.env.POSTGRES_PRISMA_URL ||
    process.env.POSTGRES_URL_NON_POOLING ||
    (process.env.POSTGRES_HOST && process.env.POSTGRES_DATABASE)
);

async function ensureTable() {
  if (!POSTGRES_ENABLED || ensured) {
    return;
  }
  await sql`CREATE TABLE IF NOT EXISTS subscription_orders (
    id varchar(64) PRIMARY KEY,
    email text NOT NULL,
    plan_id text NOT NULL,
    amount integer NOT NULL,
    currency text NOT NULL,
    tutorial_url text NOT NULL,
    status text NOT NULL,
    trade_no text,
    qr_code text,
    gateway_payload jsonb,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
  );`;
  ensured = true;
}

function createInMemoryDriver(): StorageDriver {
  if (!inMemoryInitialized) {
    inMemoryStore.clear();
    inMemoryInitialized = true;
  }

  return {
    async create(order) {
      inMemoryStore.set(order.id, order);
    },
    async update(id, updates) {
      const current = inMemoryStore.get(id);
      if (!current) return null;
      const next: OrderRecord = {
        ...current,
        ...updates,
        updatedAt: updates.updatedAt ?? new Date(),
      };
      inMemoryStore.set(id, next);
      return next;
    },
    async findByEmail(email) {
      return Array.from(inMemoryStore.values()).filter((order) => order.email === email);
    },
    async findById(id) {
      return inMemoryStore.get(id) ?? null;
    },
  };
}

type PgOrderRow = {
  id: string;
  email: string;
  plan_id: string;
  amount: number;
  currency: string;
  tutorial_url: string;
  status: string;
  trade_no: string | null;
  qr_code: string | null;
  gateway_payload: unknown;
  created_at: Date;
  updated_at: Date;
};

function mapRow(row: PgOrderRow): OrderRecord {
  return {
    id: row.id,
    email: row.email,
    planId: row.plan_id,
    amount: row.amount,
    currency: row.currency,
    tutorialUrl: row.tutorial_url,
    status: row.status as OrderStatus,
    tradeNo: row.trade_no ?? undefined,
    qrCode: row.qr_code ?? undefined,
    gatewayPayload: (row.gateway_payload as Record<string, unknown> | null) ?? undefined,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  };
}

function createPostgresDriver(): StorageDriver {
  return {
    async create(order) {
      await ensureTable();
      await sql`INSERT INTO subscription_orders (id, email, plan_id, amount, currency, tutorial_url, status, trade_no, qr_code, gateway_payload, created_at, updated_at)
        VALUES (${order.id}, ${order.email}, ${order.planId}, ${order.amount}, ${order.currency}, ${order.tutorialUrl}, ${order.status}, ${order.tradeNo ?? null}, ${order.qrCode ?? null}, ${
        order.gatewayPayload ? JSON.stringify(order.gatewayPayload) : null
      }, ${order.createdAt.toISOString()}, ${order.updatedAt.toISOString()})
        ON CONFLICT (id) DO UPDATE SET
          email = excluded.email,
          plan_id = excluded.plan_id,
          amount = excluded.amount,
          currency = excluded.currency,
          tutorial_url = excluded.tutorial_url,
          status = excluded.status,
          trade_no = excluded.trade_no,
          qr_code = excluded.qr_code,
          gateway_payload = excluded.gateway_payload,
          updated_at = excluded.updated_at;`;
    },
    async update(id, updates) {
      await ensureTable();
      const result = await sql<PgOrderRow>`UPDATE subscription_orders
        SET status = COALESCE(${updates.status ?? null}, status),
            trade_no = COALESCE(${updates.tradeNo ?? null}, trade_no),
            qr_code = COALESCE(${updates.qrCode ?? null}, qr_code),
            gateway_payload = COALESCE(${updates.gatewayPayload ? JSON.stringify(updates.gatewayPayload) : null}, gateway_payload),
            updated_at = ${updates.updatedAt?.toISOString() ?? new Date().toISOString()}
        WHERE id = ${id}
        RETURNING *;`;
      const row = result.rows[0];
      return row ? mapRow(row) : null;
    },
    async findByEmail(email) {
      await ensureTable();
      const result = await sql<PgOrderRow>`SELECT * FROM subscription_orders WHERE email = ${email} ORDER BY created_at DESC;`;
      return result.rows.map(mapRow);
    },
    async findById(id) {
      await ensureTable();
      const result = await sql<PgOrderRow>`SELECT * FROM subscription_orders WHERE id = ${id} LIMIT 1;`;
      const row = result.rows[0];
      return row ? mapRow(row) : null;
    },
  };
}

function getDriver(): StorageDriver {
  if (driver) return driver;
  driver = POSTGRES_ENABLED ? createPostgresDriver() : createInMemoryDriver();
  return driver;
}

export async function saveOrder(order: OrderRecord) {
  await getDriver().create(order);
}

export async function updateOrder(id: string, updates: Partial<OrderRecord>) {
  return getDriver().update(id, { ...updates, updatedAt: updates.updatedAt ?? new Date() });
}

export async function findOrdersByEmail(email: string) {
  return getDriver().findByEmail(email.toLowerCase());
}

export async function findOrderById(id: string) {
  return getDriver().findById(id);
}

export function isPostgresEnabled() {
  return POSTGRES_ENABLED;
}
