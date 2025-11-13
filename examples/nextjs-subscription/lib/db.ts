import { sql } from '@vercel/postgres';
import { Pool, type PoolConfig } from 'pg';

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

function getPgPool() {
  if (!PG_POOL_CONFIG) {
    return null;
  }
  if (!pool) {
    const config: PoolConfig = { ...PG_POOL_CONFIG };
    if (SHOULD_USE_POOL_DRIVER) {
      const sslOption = config.ssl;
      if (!sslOption || typeof sslOption === 'boolean') {
        config.ssl = { rejectUnauthorized: false };
      } else {
        config.ssl = { ...sslOption, rejectUnauthorized: false };
      }
    }
    pool = new Pool(config);
  }
  return pool;
}

const POSTGRES_CONNECTION_STRING =
  process.env.POSTGRES_PRISMA_URL ||
  process.env.POSTGRES_URL ||
  process.env.POSTGRES_URL_NON_POOLING ||
  null;

const IS_SUPABASE_CONNECTION = Boolean(
  process.env.SUPABASE_URL ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_JWT_SECRET ||
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    POSTGRES_CONNECTION_STRING?.includes('supabase') ||
    process.env.POSTGRES_HOST?.includes('supabase')
);

const PG_POOL_CONFIG: PoolConfig | null = (() => {
  if (POSTGRES_CONNECTION_STRING) {
    return { connectionString: POSTGRES_CONNECTION_STRING } satisfies PoolConfig;
  }
  if (process.env.POSTGRES_HOST && process.env.POSTGRES_DATABASE) {
    return {
      host: process.env.POSTGRES_HOST,
      port: Number(process.env.POSTGRES_PORT ?? 5432),
      user: process.env.POSTGRES_USER,
      password: process.env.POSTGRES_PASSWORD,
      database: process.env.POSTGRES_DATABASE,
      ssl: IS_SUPABASE_CONNECTION ? { rejectUnauthorized: false } : undefined,
    } satisfies PoolConfig;
  }
  return null;
})();

const POSTGRES_ENABLED = Boolean(PG_POOL_CONFIG);

const SHOULD_USE_POOL_DRIVER = Boolean(PG_POOL_CONFIG && IS_SUPABASE_CONNECTION);

let pool: Pool | null = null;

async function ensureTableWithSqlDriver() {
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

async function ensureTableWithPoolDriver(pgPool: Pool) {
  if (!POSTGRES_ENABLED || ensured) {
    return;
  }
  await pgPool.query(`
    CREATE TABLE IF NOT EXISTS subscription_orders (
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
    );
  `);
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
      await ensureTableWithSqlDriver();
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
      await ensureTableWithSqlDriver();
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
      await ensureTableWithSqlDriver();
      const result = await sql<PgOrderRow>`SELECT * FROM subscription_orders WHERE email = ${email} ORDER BY created_at DESC;`;
      return result.rows.map(mapRow);
    },
    async findById(id) {
      await ensureTableWithSqlDriver();
      const result = await sql<PgOrderRow>`SELECT * FROM subscription_orders WHERE id = ${id} LIMIT 1;`;
      const row = result.rows[0];
      return row ? mapRow(row) : null;
    },
  };
}

function createPoolPostgresDriver(pgPool: Pool): StorageDriver {
  return {
    async create(order) {
      await ensureTableWithPoolDriver(pgPool);
      await pgPool.query(
        `INSERT INTO subscription_orders (id, email, plan_id, amount, currency, tutorial_url, status, trade_no, qr_code, gateway_payload, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
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
           updated_at = excluded.updated_at;`,
        [
          order.id,
          order.email,
          order.planId,
          order.amount,
          order.currency,
          order.tutorialUrl,
          order.status,
          order.tradeNo ?? null,
          order.qrCode ?? null,
          order.gatewayPayload ? JSON.stringify(order.gatewayPayload) : null,
          order.createdAt,
          order.updatedAt,
        ]
      );
    },
    async update(id, updates) {
      await ensureTableWithPoolDriver(pgPool);
      const timestamp = updates.updatedAt ?? new Date();
      const result = await pgPool.query<PgOrderRow>(
        `UPDATE subscription_orders
           SET status = COALESCE($2, status),
               trade_no = COALESCE($3, trade_no),
               qr_code = COALESCE($4, qr_code),
               gateway_payload = COALESCE($5, gateway_payload),
               updated_at = $6
         WHERE id = $1
         RETURNING *;`,
        [
          id,
          updates.status ?? null,
          updates.tradeNo ?? null,
          updates.qrCode ?? null,
          updates.gatewayPayload ? JSON.stringify(updates.gatewayPayload) : null,
          timestamp,
        ]
      );
      const row = result.rows[0];
      return row ? mapRow(row) : null;
    },
    async findByEmail(email) {
      await ensureTableWithPoolDriver(pgPool);
      const result = await pgPool.query<PgOrderRow>(
        `SELECT * FROM subscription_orders WHERE email = $1 ORDER BY created_at DESC;`,
        [email]
      );
      return result.rows.map(mapRow);
    },
    async findById(id) {
      await ensureTableWithPoolDriver(pgPool);
      const result = await pgPool.query<PgOrderRow>(
        `SELECT * FROM subscription_orders WHERE id = $1 LIMIT 1;`,
        [id]
      );
      const row = result.rows[0];
      return row ? mapRow(row) : null;
    },
  };
}

function getDriver(): StorageDriver {
  if (driver) return driver;
  if (SHOULD_USE_POOL_DRIVER) {
    const pgPool = getPgPool();
    if (pgPool) {
      driver = createPoolPostgresDriver(pgPool);
      return driver;
    }
  }
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
