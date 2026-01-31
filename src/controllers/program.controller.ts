import { Request, Response } from 'express';
import prisma from '../config/database';

export const createProgram = async (req: Request, res: Response) => {
  const { name, description } = req.body;

  const program = await prisma.program.create({
    data: {
      name,
      description,
      coachId: req.user!.id, // assumed from auth middleware
    },
  });

  res.status(201).json(program);
};

export const assignRoutineToProgram = async (req: Request, res: Response) => {
  const { programId } = req.params;
  const { routineId, dayNumber } = req.body;

  const assignment = await prisma.programRoutine.create({
    data: {
      programId: Array.isArray(programId) ? programId[0] : programId,
      routineId,
      dayNumber,
    },
  });

  res.status(201).json(assignment);
};

export const addExerciseToRoutine = async (req: Request, res: Response) => {
  const { routineId } = req.params;
  const data = req.body;

  const routineExercise = await prisma.routineExercise.create({
    data: {
      routineId,
      ...data,
    },
  });

  res.status(201).json(routineExercise);
};
