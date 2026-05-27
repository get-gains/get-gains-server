-- AlterTable
ALTER TABLE "user" ADD COLUMN     "standalone_last_workout_date" TIMESTAMPTZ,
ADD COLUMN     "standalone_streak_days" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "standalone_program" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "is_active" BOOLEAN NOT NULL DEFAULT false,
    "deleted_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "standalone_program_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "standalone_program_routine" (
    "id" TEXT NOT NULL,
    "program_id" TEXT NOT NULL,
    "routine_id" TEXT NOT NULL,
    "order_in_program" INTEGER NOT NULL DEFAULT 1,
    "deleted_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "standalone_program_routine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "standalone_program_routine_exercise" (
    "id" TEXT NOT NULL,
    "program_routine_id" TEXT NOT NULL,
    "exercise_id" TEXT NOT NULL,
    "sets" INTEGER NOT NULL DEFAULT 3,
    "reps_min" INTEGER NOT NULL DEFAULT 8,
    "reps_max" INTEGER NOT NULL DEFAULT 12,
    "rest_seconds" INTEGER NOT NULL DEFAULT 60,
    "order_in_routine" INTEGER NOT NULL DEFAULT 1,
    "deleted_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "standalone_program_routine_exercise_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "standalone_session" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "program_routine_id" TEXT NOT NULL,
    "started_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMPTZ,
    "feedback" TEXT,
    "deleted_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "standalone_session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "standalone_performed_set" (
    "id" TEXT NOT NULL,
    "session_id" TEXT NOT NULL,
    "routine_exercise_id" TEXT NOT NULL,
    "set_number" INTEGER NOT NULL,
    "reps" INTEGER NOT NULL,
    "weight" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "standalone_performed_set_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "standalone_program_user_id_deleted_at_idx" ON "standalone_program"("user_id", "deleted_at");

-- CreateIndex
CREATE INDEX "standalone_program_routine_program_id_idx" ON "standalone_program_routine"("program_id");

-- CreateIndex
CREATE INDEX "standalone_program_routine_routine_id_idx" ON "standalone_program_routine"("routine_id");

-- CreateIndex
CREATE INDEX "standalone_program_routine_exercise_program_routine_id_idx" ON "standalone_program_routine_exercise"("program_routine_id");

-- CreateIndex
CREATE INDEX "standalone_program_routine_exercise_exercise_id_idx" ON "standalone_program_routine_exercise"("exercise_id");

-- CreateIndex
CREATE INDEX "standalone_session_user_id_completed_at_idx" ON "standalone_session"("user_id", "completed_at");

-- CreateIndex
CREATE INDEX "standalone_session_program_routine_id_idx" ON "standalone_session"("program_routine_id");

-- CreateIndex
CREATE INDEX "standalone_performed_set_session_id_idx" ON "standalone_performed_set"("session_id");

-- CreateIndex
CREATE INDEX "standalone_performed_set_routine_exercise_id_idx" ON "standalone_performed_set"("routine_exercise_id");

-- AddForeignKey
ALTER TABLE "standalone_program" ADD CONSTRAINT "standalone_program_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("supabase_auth_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "standalone_program_routine" ADD CONSTRAINT "standalone_program_routine_program_id_fkey" FOREIGN KEY ("program_id") REFERENCES "standalone_program"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "standalone_program_routine" ADD CONSTRAINT "standalone_program_routine_routine_id_fkey" FOREIGN KEY ("routine_id") REFERENCES "routine"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "standalone_program_routine_exercise" ADD CONSTRAINT "standalone_program_routine_exercise_program_routine_id_fkey" FOREIGN KEY ("program_routine_id") REFERENCES "standalone_program_routine"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "standalone_program_routine_exercise" ADD CONSTRAINT "standalone_program_routine_exercise_exercise_id_fkey" FOREIGN KEY ("exercise_id") REFERENCES "exercise"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "standalone_session" ADD CONSTRAINT "standalone_session_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("supabase_auth_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "standalone_session" ADD CONSTRAINT "standalone_session_program_routine_id_fkey" FOREIGN KEY ("program_routine_id") REFERENCES "standalone_program_routine"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "standalone_performed_set" ADD CONSTRAINT "standalone_performed_set_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "standalone_session"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "standalone_performed_set" ADD CONSTRAINT "standalone_performed_set_routine_exercise_id_fkey" FOREIGN KEY ("routine_exercise_id") REFERENCES "standalone_program_routine_exercise"("id") ON DELETE CASCADE ON UPDATE CASCADE;
