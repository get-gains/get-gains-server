import { Request, Response } from 'express';
import prisma from '../config/database';
import { sendSuccess, sendSingleError } from '../utils/response';

export const createProgram = async (req: Request, res: Response) => {
  const coach = req.coach;
  if (!coach) {
    sendSingleError(res, 'Coach required', 403);
    return;
  }

  const { name, description } = req.body;

  const program = await prisma.program.create({
    data: {
      name,
      description,
      coachId: coach.id,
    },
  });

  sendSuccess(res, { program }, 201);
};

export const assignRoutineToProgram = async (req: Request, res: Response) => {
  const coach = req.coach;
  if (!coach) {
    sendSingleError(res, 'Coach required', 403);
    return;
  }

  const { programId } = req.params;
  const { routineId, dayNumber } = req.body;
  const pid = Array.isArray(programId) ? programId[0] : programId;

  const program = await prisma.program.findUnique({
    where: { id: pid },
  });

  if (!program || program.coachId !== coach.id) {
    sendSingleError(res, 'Program not found or access denied', 403);
    return;
  }

  const assignment = await prisma.programRoutine.create({
    data: {
      programId: pid,
      routineId,
      dayNumber,
    },
  });

  sendSuccess(res, { assignment }, 201);
};

export const addExerciseToRoutine = async (req: Request, res: Response) => {
  const coach = req.coach;
  if (!coach) {
    sendSingleError(res, 'Coach required', 403);
    return;
  }

  const { routineId } = req.params;
  const rid = Array.isArray(routineId) ? routineId[0] : routineId;
  const data = req.body;

  const routine = await prisma.routine.findUnique({
    where: { id: rid },
  });

  if (!routine) {
    sendSingleError(res, 'Routine not found', 404);
    return;
  }

  const routineExercise = await prisma.routineExercise.create({
    data: {
      routineId: rid,
      ...data,
    },
  });

  sendSuccess(res, { routineExercise }, 201);
};
