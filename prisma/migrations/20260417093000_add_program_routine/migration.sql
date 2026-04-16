-- CreateTable
CREATE TABLE "program_routine" (
    "id" TEXT NOT NULL,
    "program_id" TEXT NOT NULL,
    "routine_id" TEXT NOT NULL,
    "day_of_week" TEXT NOT NULL,
    "deleted_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "program_routine_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "program_routine_program_id_day_of_week_key" ON "program_routine"("program_id", "day_of_week");

-- CreateIndex
CREATE INDEX "program_routine_program_id_idx" ON "program_routine"("program_id");

-- CreateIndex
CREATE INDEX "program_routine_routine_id_idx" ON "program_routine"("routine_id");

-- AddForeignKey
ALTER TABLE "program_routine"
ADD CONSTRAINT "program_routine_program_id_fkey"
FOREIGN KEY ("program_id") REFERENCES "program"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "program_routine"
ADD CONSTRAINT "program_routine_routine_id_fkey"
FOREIGN KEY ("routine_id") REFERENCES "routine"("id") ON DELETE CASCADE ON UPDATE CASCADE;
