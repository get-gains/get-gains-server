-- CreateTable
CREATE TABLE "routine_exercise" (
    "id" TEXT NOT NULL,
    "routine_id" TEXT NOT NULL,
    "exercise_id" TEXT NOT NULL,
    "sets" INTEGER NOT NULL,
    "reps_min" INTEGER NOT NULL,
    "reps_max" INTEGER NOT NULL,
    "rest_seconds" INTEGER NOT NULL,
    "order_in_routine" INTEGER NOT NULL,
    "notes" TEXT,
    "deleted_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "routine_exercise_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "routine_exercise_routine_id_idx" ON "routine_exercise"("routine_id");

-- CreateIndex
CREATE INDEX "routine_exercise_exercise_id_idx" ON "routine_exercise"("exercise_id");

-- AddForeignKey
ALTER TABLE "routine_exercise"
ADD CONSTRAINT "routine_exercise_routine_id_fkey"
FOREIGN KEY ("routine_id") REFERENCES "routine"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "routine_exercise"
ADD CONSTRAINT "routine_exercise_exercise_id_fkey"
FOREIGN KEY ("exercise_id") REFERENCES "exercise"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
