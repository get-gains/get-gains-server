import prisma from '../config/database';
import { CreateUserData } from '../schemas/user.schema';

export const createUser = async (data: CreateUserData) => {
  const { email, name, nickname, supabaseId } = data;
  // Create user in database
  const user = await prisma.user.create({
    data: {
      email: email.toLowerCase(),
      name,
      nickname,
      supabaseId,
    },
  });

  return user;
};
