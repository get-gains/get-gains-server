-- CreateEnum
CREATE TYPE "BodySegment" AS ENUM ('HEAD_NECK', 'LEFT_ARM', 'RIGHT_ARM', 'TORSO', 'LEFT_LEG', 'RIGHT_LEG', 'FULL_BODY');

-- CreateEnum
CREATE TYPE "CameraAngle" AS ENUM ('FRONT', 'SIDE_LEFT', 'SIDE_RIGHT', 'REAR', 'ANGLE_45_LEFT', 'ANGLE_45_RIGHT');

-- CreateTable
CREATE TABLE "ExercisePoseConfig" (
    "id" TEXT NOT NULL,
    "exerciseId" TEXT NOT NULL,
    "activeSegments" "BodySegment"[],
    "recommendedAngles" "CameraAngle"[],
    "trackedAngles" JSONB NOT NULL,
    "minLandmarkConfidence" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
    "setupInstructions" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "ExercisePoseConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExerciseForm" (
    "id" TEXT NOT NULL,
    "exerciseId" TEXT NOT NULL,
    "coachId" TEXT NOT NULL,
    "cameraAngle" "CameraAngle" NOT NULL,
    "durationMs" INTEGER NOT NULL,
    "frameRate" INTEGER NOT NULL,
    "totalFrames" INTEGER NOT NULL,
    "landmarkFrames" JSONB NOT NULL,
    "featureFrames" JSONB NOT NULL,
    "normalizedFrames" JSONB,
    "version" INTEGER NOT NULL DEFAULT 1,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "avgLandmarkConfidence" DOUBLE PRECISION,
    "recordingQuality" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "ExerciseForm_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FormComparisonResult" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "exerciseFormId" TEXT NOT NULL,
    "workoutSessionId" TEXT,
    "routineExerciseId" TEXT,
    "overallScore" DOUBLE PRECISION NOT NULL,
    "segmentScores" JSONB NOT NULL,
    "corrections" JSONB NOT NULL,
    "cameraAngle" "CameraAngle" NOT NULL,
    "durationMs" INTEGER NOT NULL,
    "frameRate" INTEGER NOT NULL,
    "totalFrames" INTEGER NOT NULL,
    "avgLandmarkConfidence" DOUBLE PRECISION,
    "clientLandmarkFrames" JSONB,
    "clientFeatureFrames" JSONB,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FormComparisonResult_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ExercisePoseConfig_exerciseId_key" ON "ExercisePoseConfig"("exerciseId");

-- CreateIndex
CREATE INDEX "ExerciseForm_exerciseId_isActive_idx" ON "ExerciseForm"("exerciseId", "isActive");

-- CreateIndex
CREATE INDEX "ExerciseForm_coachId_idx" ON "ExerciseForm"("coachId");

-- CreateIndex
CREATE INDEX "FormComparisonResult_userId_exerciseFormId_idx" ON "FormComparisonResult"("userId", "exerciseFormId");

-- CreateIndex
CREATE INDEX "FormComparisonResult_userId_createdAt_idx" ON "FormComparisonResult"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "FormComparisonResult_workoutSessionId_idx" ON "FormComparisonResult"("workoutSessionId");

-- AddForeignKey
ALTER TABLE "ExercisePoseConfig" ADD CONSTRAINT "ExercisePoseConfig_exerciseId_fkey" FOREIGN KEY ("exerciseId") REFERENCES "Exercise"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExerciseForm" ADD CONSTRAINT "ExerciseForm_exerciseId_fkey" FOREIGN KEY ("exerciseId") REFERENCES "Exercise"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExerciseForm" ADD CONSTRAINT "ExerciseForm_coachId_fkey" FOREIGN KEY ("coachId") REFERENCES "Coach"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FormComparisonResult" ADD CONSTRAINT "FormComparisonResult_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FormComparisonResult" ADD CONSTRAINT "FormComparisonResult_exerciseFormId_fkey" FOREIGN KEY ("exerciseFormId") REFERENCES "ExerciseForm"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FormComparisonResult" ADD CONSTRAINT "FormComparisonResult_workoutSessionId_fkey" FOREIGN KEY ("workoutSessionId") REFERENCES "WorkoutSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FormComparisonResult" ADD CONSTRAINT "FormComparisonResult_routineExerciseId_fkey" FOREIGN KEY ("routineExerciseId") REFERENCES "RoutineExercise"("id") ON DELETE SET NULL ON UPDATE CASCADE;
