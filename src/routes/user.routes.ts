import { Router } from 'express';
import {
  getUser,
  createUser,
  updateUser,
  deleteUser,
} from '../controllers/user.controller';
import { validateRequest } from '../middleware/validate.middleware';
import {
  GetUserSchema,
  CreateUserSchema,
  UpdateUserSchema,
} from '../schemas/user.schema';

const router = Router();

/**
 * @route   GET /users/:id
 * @desc    Get a user by ID
 * @access  Public
 */
router.get('/:id', validateRequest(GetUserSchema), getUser);

/**
 * @route   POST /users
 * @desc    Create a new user
 * @access  Public
 */
router.post('/', validateRequest(CreateUserSchema), createUser);

/**
 * @route   PUT /users/:id
 * @desc    Update a user by ID
 * @access  Public
 */
router.put('/:id', validateRequest(UpdateUserSchema), updateUser);

/**
 * @route   DELETE /users/:id
 * @desc    Delete a user by ID
 * @access  Public
 */
router.delete('/:id', validateRequest(GetUserSchema), deleteUser);

export default router;
