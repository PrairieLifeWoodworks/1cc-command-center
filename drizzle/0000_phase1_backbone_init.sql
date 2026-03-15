CREATE TABLE "branch" (
	"id" uuid PRIMARY KEY NOT NULL,
	"tenant_id" uuid NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"timezone" text NOT NULL,
	"business_hours_json" jsonb,
	"closure_calendar_json" jsonb,
	"status" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "normalized_event" (
	"id" uuid PRIMARY KEY NOT NULL,
	"raw_event_id" uuid NOT NULL,
	"tenant_id" uuid NOT NULL,
	"branch_id" uuid NOT NULL,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL,
	"raw_event_type" text NOT NULL,
	"normalized_event_class" text NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" text,
	"status_code_raw" text,
	"dedupe_key" text NOT NULL,
	"duplicate" boolean DEFAULT false NOT NULL,
	"normalization_version" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "raw_webhook_event" (
	"id" uuid PRIMARY KEY NOT NULL,
	"tenant_id" uuid NOT NULL,
	"branch_id" uuid NOT NULL,
	"source" text NOT NULL,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL,
	"headers_json" jsonb NOT NULL,
	"payload_json" jsonb NOT NULL,
	"payload_hash" text NOT NULL,
	"auth_result" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "smartmoving_connection" (
	"id" uuid PRIMARY KEY NOT NULL,
	"branch_id" uuid NOT NULL,
	"api_base_url" text NOT NULL,
	"api_key_secret_ref" text NOT NULL,
	"webhook_secret_ref" text NOT NULL,
	"onboarding_status" text NOT NULL,
	"last_verified_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tenant" (
	"id" uuid PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"status" text NOT NULL,
	"timezone_default" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "branch" ADD CONSTRAINT "branch_tenant_id_tenant_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenant"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "normalized_event" ADD CONSTRAINT "normalized_event_raw_event_id_raw_webhook_event_id_fk" FOREIGN KEY ("raw_event_id") REFERENCES "public"."raw_webhook_event"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "normalized_event" ADD CONSTRAINT "normalized_event_tenant_id_tenant_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenant"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "normalized_event" ADD CONSTRAINT "normalized_event_branch_id_branch_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branch"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "raw_webhook_event" ADD CONSTRAINT "raw_webhook_event_tenant_id_tenant_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenant"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "raw_webhook_event" ADD CONSTRAINT "raw_webhook_event_branch_id_branch_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branch"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "smartmoving_connection" ADD CONSTRAINT "smartmoving_connection_branch_id_branch_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branch"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "branch_tenant_slug_uidx" ON "branch" USING btree ("tenant_id","slug");--> statement-breakpoint
CREATE UNIQUE INDEX "normalized_event_raw_event_id_uidx" ON "normalized_event" USING btree ("raw_event_id");--> statement-breakpoint
CREATE INDEX "normalized_event_dedupe_key_idx" ON "normalized_event" USING btree ("dedupe_key");--> statement-breakpoint
CREATE INDEX "normalized_event_entity_idx" ON "normalized_event" USING btree ("entity_type","entity_id");--> statement-breakpoint
CREATE INDEX "raw_webhook_event_tenant_branch_received_at_idx" ON "raw_webhook_event" USING btree ("tenant_id","branch_id","received_at");--> statement-breakpoint
CREATE INDEX "raw_webhook_event_payload_hash_idx" ON "raw_webhook_event" USING btree ("payload_hash");--> statement-breakpoint
CREATE UNIQUE INDEX "smartmoving_connection_branch_uidx" ON "smartmoving_connection" USING btree ("branch_id");--> statement-breakpoint
CREATE UNIQUE INDEX "tenant_slug_uidx" ON "tenant" USING btree ("slug");
