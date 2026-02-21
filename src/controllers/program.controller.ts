import { Request, Response } from 'express';
import prisma from '../config/database';
import { sendSuccess, sendSingleError } from '../utils/response';
import {
  CreateProgramSchema,
  AssignRoutineSchema,
  addRoutineExerciseSchema,
} from '../schemas/program.schema';
import { z } from 'zod';

export const createProgram = async (req: Request, res: Response) => {
  const coach = req.coach;
  if (!coach) {
    sendSingleError(res, 'Coach required', 403);
    return;
  }

  const { name, description } = res.locals.validated?.body as z.infer<
    typeof CreateProgramSchema
  >['body'];

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

  const { programId } = res.locals.validated?.params as z.infer<
    typeof AssignRoutineSchema
  >['params'];
  const { routineId, dayNumber } = res.locals.validated?.body as z.infer<
    typeof AssignRoutineSchema
  >['body'];
  const pid = programId;

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

  const { routineId } = res.locals.validated?.params as z.infer<
    typeof addRoutineExerciseSchema
  >['params'];
  const rid = routineId;
  const data = res.locals.validated?.body as z.infer<
    typeof addRoutineExerciseSchema
  >['body'];

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
