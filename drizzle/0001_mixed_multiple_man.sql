CREATE TABLE "hydrated_opportunity_snapshot" (
	"id" uuid PRIMARY KEY NOT NULL,
	"normalized_event_id" uuid NOT NULL,
	"raw_event_id" uuid NOT NULL,
	"tenant_id" uuid NOT NULL,
	"branch_id" uuid NOT NULL,
	"opportunity_id" text NOT NULL,
	"fetched_at" timestamp with time zone DEFAULT now() NOT NULL,
	"opportunity_json" jsonb NOT NULL,
	"audit_activity_json" jsonb,
	"followups_json" jsonb,
	"snapshot_version" text NOT NULL
);
--> statement-breakpoint
ALTER TABLE "hydrated_opportunity_snapshot" ADD CONSTRAINT "hydrated_opportunity_snapshot_normalized_event_id_normalized_event_id_fk" FOREIGN KEY ("normalized_event_id") REFERENCES "public"."normalized_event"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hydrated_opportunity_snapshot" ADD CONSTRAINT "hydrated_opportunity_snapshot_raw_event_id_raw_webhook_event_id_fk" FOREIGN KEY ("raw_event_id") REFERENCES "public"."raw_webhook_event"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hydrated_opportunity_snapshot" ADD CONSTRAINT "hydrated_opportunity_snapshot_tenant_id_tenant_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenant"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hydrated_opportunity_snapshot" ADD CONSTRAINT "hydrated_opportunity_snapshot_branch_id_branch_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branch"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "hydrated_opportunity_snapshot_normalized_event_id_uidx" ON "hydrated_opportunity_snapshot" USING btree ("normalized_event_id");--> statement-breakpoint
CREATE INDEX "hydrated_opportunity_snapshot_opportunity_idx" ON "hydrated_opportunity_snapshot" USING btree ("tenant_id","branch_id","opportunity_id");