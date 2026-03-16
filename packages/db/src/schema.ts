import {
  boolean,
  index,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid
} from "drizzle-orm/pg-core";

export const tenant = pgTable(
  "tenant",
  {
    id: uuid("id").primaryKey(),
    slug: text("slug").notNull(),
    name: text("name").notNull(),
    status: text("status").notNull(),
    timezoneDefault: text("timezone_default").notNull(),
    createdAt: timestamp("created_at", {
      withTimezone: true,
      mode: "date"
    })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", {
      withTimezone: true,
      mode: "date"
    })
      .notNull()
      .defaultNow()
  },
  (table) => [uniqueIndex("tenant_slug_uidx").on(table.slug)]
);

export const branch = pgTable(
  "branch",
  {
    id: uuid("id").primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenant.id),
    slug: text("slug").notNull(),
    name: text("name").notNull(),
    timezone: text("timezone").notNull(),
    businessHoursJson: jsonb("business_hours_json"),
    closureCalendarJson: jsonb("closure_calendar_json"),
    status: text("status").notNull(),
    createdAt: timestamp("created_at", {
      withTimezone: true,
      mode: "date"
    })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", {
      withTimezone: true,
      mode: "date"
    })
      .notNull()
      .defaultNow()
  },
  (table) => [
    uniqueIndex("branch_tenant_slug_uidx").on(table.tenantId, table.slug)
  ]
);

export const smartmovingConnection = pgTable(
  "smartmoving_connection",
  {
    id: uuid("id").primaryKey(),
    branchId: uuid("branch_id")
      .notNull()
      .references(() => branch.id),
    apiBaseUrl: text("api_base_url").notNull(),
    apiKeySecretRef: text("api_key_secret_ref").notNull(),
    webhookSecretRef: text("webhook_secret_ref").notNull(),
    onboardingStatus: text("onboarding_status").notNull(),
    lastVerifiedAt: timestamp("last_verified_at", {
      withTimezone: true,
      mode: "date"
    }),
    createdAt: timestamp("created_at", {
      withTimezone: true,
      mode: "date"
    })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", {
      withTimezone: true,
      mode: "date"
    })
      .notNull()
      .defaultNow()
  },
  (table) => [uniqueIndex("smartmoving_connection_branch_uidx").on(table.branchId)]
);

export const rawWebhookEvent = pgTable(
  "raw_webhook_event",
  {
    id: uuid("id").primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenant.id),
    branchId: uuid("branch_id")
      .notNull()
      .references(() => branch.id),
    source: text("source").notNull(),
    receivedAt: timestamp("received_at", {
      withTimezone: true,
      mode: "date"
    })
      .notNull()
      .defaultNow(),
    headersJson: jsonb("headers_json").notNull(),
    payloadJson: jsonb("payload_json").notNull(),
    payloadHash: text("payload_hash").notNull(),
    authResult: text("auth_result").notNull()
  },
  (table) => [
    index("raw_webhook_event_tenant_branch_received_at_idx").on(
      table.tenantId,
      table.branchId,
      table.receivedAt
    ),
    index("raw_webhook_event_payload_hash_idx").on(table.payloadHash)
  ]
);

export const normalizedEvent = pgTable(
  "normalized_event",
  {
    id: uuid("id").primaryKey(),
    rawEventId: uuid("raw_event_id")
      .notNull()
      .references(() => rawWebhookEvent.id),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenant.id),
    branchId: uuid("branch_id")
      .notNull()
      .references(() => branch.id),
    receivedAt: timestamp("received_at", {
      withTimezone: true,
      mode: "date"
    })
      .notNull()
      .defaultNow(),
    rawEventType: text("raw_event_type").notNull(),
    normalizedEventClass: text("normalized_event_class").notNull(),
    entityType: text("entity_type").notNull(),
    entityId: text("entity_id"),
    statusCodeRaw: text("status_code_raw"),
    dedupeKey: text("dedupe_key").notNull(),
    duplicate: boolean("duplicate").notNull().default(false),
    normalizationVersion: text("normalization_version").notNull()
  },
  (table) => [
    uniqueIndex("normalized_event_raw_event_id_uidx").on(table.rawEventId),
    index("normalized_event_dedupe_key_idx").on(table.dedupeKey),
    index("normalized_event_entity_idx").on(table.entityType, table.entityId)
  ]
);

export const hydratedOpportunitySnapshot = pgTable(
  "hydrated_opportunity_snapshot",
  {
    id: uuid("id").primaryKey(),
    normalizedEventId: uuid("normalized_event_id")
      .notNull()
      .references(() => normalizedEvent.id),
    rawEventId: uuid("raw_event_id")
      .notNull()
      .references(() => rawWebhookEvent.id),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenant.id),
    branchId: uuid("branch_id")
      .notNull()
      .references(() => branch.id),
    opportunityId: text("opportunity_id").notNull(),
    fetchedAt: timestamp("fetched_at", {
      withTimezone: true,
      mode: "date"
    })
      .notNull()
      .defaultNow(),
    opportunityJson: jsonb("opportunity_json").notNull(),
    auditActivityJson: jsonb("audit_activity_json"),
    followupsJson: jsonb("followups_json"),
    snapshotVersion: text("snapshot_version").notNull()
  },
  (table) => [
    uniqueIndex("hydrated_opportunity_snapshot_normalized_event_id_uidx").on(
      table.normalizedEventId
    ),
    index("hydrated_opportunity_snapshot_opportunity_idx").on(
      table.tenantId,
      table.branchId,
      table.opportunityId
    )
  ]
);
