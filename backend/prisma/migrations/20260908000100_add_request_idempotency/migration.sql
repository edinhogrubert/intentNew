-- Additive: existing Intents and domain events are not changed.
CREATE TABLE "idempotency_requests" (
    "id" UUID NOT NULL,
    "actor_id" UUID NOT NULL,
    "operation" VARCHAR(80) NOT NULL,
    "key" VARCHAR(128) NOT NULL,
    "request_hash" VARCHAR(64) NOT NULL,
    "response" JSONB,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "idempotency_requests_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "idempotency_requests_actor_id_fkey" FOREIGN KEY ("actor_id")
      REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "idempotency_requests_actor_id_operation_key_key"
    ON "idempotency_requests"("actor_id", "operation", "key");
