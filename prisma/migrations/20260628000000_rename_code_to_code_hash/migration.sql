-- RenameTable
ALTER TABLE "coach_invitation" RENAME COLUMN "code" TO "code_hash";
ALTER TABLE "email_verification_code" RENAME COLUMN "code" TO "code_hash";

-- CreateIndex
CREATE UNIQUE INDEX "standalone_performed_set_session_id_routine_exercise_d_key" ON "standalone_performed_set"("session_id","routine_exercise_id","set_number");
