CREATE TABLE "personal_contact_lists" (
    "id" UUID NOT NULL,
    "owner_id" UUID NOT NULL,
    "name" VARCHAR(80) NOT NULL,
    "name_key" VARCHAR(80) NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    CONSTRAINT "personal_contact_lists_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "personal_contact_list_members" (
    "id" UUID NOT NULL,
    "list_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "personal_contact_list_members_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "personal_contact_lists_owner_id_name_key_key" ON "personal_contact_lists"("owner_id", "name_key");
CREATE INDEX "personal_contact_lists_owner_id_updated_at_idx" ON "personal_contact_lists"("owner_id", "updated_at" DESC);
CREATE UNIQUE INDEX "personal_contact_list_members_list_id_user_id_key" ON "personal_contact_list_members"("list_id", "user_id");
CREATE INDEX "personal_contact_list_members_list_id_created_at_idx" ON "personal_contact_list_members"("list_id", "created_at");
CREATE INDEX "personal_contact_list_members_user_id_created_at_idx" ON "personal_contact_list_members"("user_id", "created_at");

ALTER TABLE "personal_contact_lists" ADD CONSTRAINT "personal_contact_lists_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "personal_contact_list_members" ADD CONSTRAINT "personal_contact_list_members_list_id_fkey" FOREIGN KEY ("list_id") REFERENCES "personal_contact_lists"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "personal_contact_list_members" ADD CONSTRAINT "personal_contact_list_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
