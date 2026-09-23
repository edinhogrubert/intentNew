CREATE TABLE "intent_watches" (
    "id" UUID NOT NULL,
    "intent_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "intent_watches_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "intent_watches_intent_id_user_id_key"
    ON "intent_watches"("intent_id", "user_id");

CREATE INDEX "intent_watches_user_id_created_at_idx"
    ON "intent_watches"("user_id", "created_at" DESC);

ALTER TABLE "intent_watches"
    ADD CONSTRAINT "intent_watches_intent_id_fkey"
    FOREIGN KEY ("intent_id") REFERENCES "intents"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "intent_watches"
    ADD CONSTRAINT "intent_watches_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

