-- CreateTable
CREATE TABLE "admin_scope" (
    "supabase_auth_id" TEXT NOT NULL,
    "scope" TEXT NOT NULL,

    CONSTRAINT "admin_scope_pkey" PRIMARY KEY ("supabase_auth_id","scope")
);

-- CreateTable
CREATE TABLE "admin_invitation" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "token_hash" TEXT NOT NULL,
    "scopes" TEXT[],
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "max_attempts" INTEGER NOT NULL DEFAULT 5,
    "created_by" TEXT NOT NULL,
    "accepted_by" TEXT,
    "revoked_by" TEXT,
    "accepted_at" TIMESTAMPTZ,
    "revoked_at" TIMESTAMPTZ,
    "expires_at" TIMESTAMPTZ NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "admin_invitation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "admin_invitation_token_hash_key" ON "admin_invitation"("token_hash");

-- CreateIndex
CREATE INDEX "admin_invitation_status_idx" ON "admin_invitation"("status");

-- CreateIndex
CREATE INDEX "admin_invitation_email_idx" ON "admin_invitation"("email");

-- CreateIndex
CREATE INDEX "admin_invitation_expires_at_idx" ON "admin_invitation"("expires_at");

-- AddForeignKey
ALTER TABLE "admin_scope" ADD CONSTRAINT "admin_scope_supabase_auth_id_fkey" FOREIGN KEY ("supabase_auth_id") REFERENCES "user"("supabase_auth_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "admin_invitation" ADD CONSTRAINT "admin_invitation_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "user"("supabase_auth_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "admin_invitation" ADD CONSTRAINT "admin_invitation_accepted_by_fkey" FOREIGN KEY ("accepted_by") REFERENCES "user"("supabase_auth_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "admin_invitation" ADD CONSTRAINT "admin_invitation_revoked_by_fkey" FOREIGN KEY ("revoked_by") REFERENCES "user"("supabase_auth_id") ON DELETE SET NULL ON UPDATE CASCADE;
