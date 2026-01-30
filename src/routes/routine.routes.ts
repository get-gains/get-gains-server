import { Router } from 'express';
import prisma from '../config/database';

const router = Router();
export default router;

/** * @route   GET /exercises
 * @desc    Get all exercises
 * @access  Public
 */
router.get('/', async (req, res) => {
  try {
    const exercises = await prisma.exercise.findMany();
    res.json(exercises);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * @route   POST /programs
 * @desc    Create a workout program
 */
router.post('/programs', async (req, res) => {
  try {
    const { name, description, coachId } = req.body;

    const program = await prisma.program.create({
      data: {
        name,
        description,
        coachId,
      },
    });

    res.status(201).json(program);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to create program' });
  }
});

/**
 * @route   POST /programs/:programId/routines
 * @desc    Assign routine to a day of the week
 */
router.post('/programs/:programId/routines', async (req, res) => {
  try {
    const { programId } = req.params;
    const { routineId, dayNumber } = req.body;

    const assignment = await prisma.programRoutine.create({
      data: {
        programId,
        routineId,
        dayNumber,
      },
    });

    res.status(201).json(assignment);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to assign routine' });
  }
});

/**
 * @route   POST /routines/:routineId/exercises
 * @desc    Add exercise to a routine with target muscles
 */
router.post('/:routineId/exercises', async (req, res) => {
  try {
    const { routineId } = req.params;
    const {
      exerciseId,
      sets,
      repsMin,
      repsMax,
      restSeconds,
      orderInRoutine,
      notes,
    } = req.body;

    const routineExercise = await prisma.routineExercise.create({
      data: {
        routineId,
        exerciseId,
        sets,
        repsMin,
        repsMax,
        restSeconds,
        orderInRoutine,
        notes,
      },
    });

    res.status(201).json(routineExercise);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to add exercise to routine' });
  }
});

/**
 * @route   GET /calendar
 * @desc    Get scheduled routines for date range
 */
router.get('/calendar/:assignedProgramId', async (req, res) => {
  try {
    const { assignedProgramId } = req.params;

    const routines = await prisma.programRoutine.findMany({
      where: {
        program: {
          assignedPrograms: {
            some: { id: assignedProgramId },
          },
        },
      },
      include: {
        routine: true,
      },
    });

    res.json(routines);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to load calendar' });
  }
});

/**
 * @route   POST /workout-sessions
 * @desc    Record a completed workout
 */
router.post('/workout-sessions', async (req, res) => {
  try {
    const { userId, assignedProgramId, startedAt, completedAt, notes } =
      req.body;

    const session = await prisma.workoutSession.create({
      data: {
        userId,
        assignedProgramId,
        startedAt: new Date(startedAt),
        completedAt: completedAt ? new Date(completedAt) : null,
        notes,
      },
    });

    res.status(201).json(session);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to save workout session' });
  }
});

/**
 * @route   GET /stats/consistency
 * @desc    Get workout consistency stats
 */
router.get('/stats/consistency', async (req, res) => {
  try {
    const count = await prisma.workoutSession.count();
    res.json({ totalWorkouts: count });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to load stats' });
  }
});
