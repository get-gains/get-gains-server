-- AlterTable: promote user_id to PK, drop redundant id column

-- Drop the existing primary key on id
ALTER TABLE "user_subscription" DROP CONSTRAINT "user_subscription_pkey";

-- Drop the redundant unique index on user_id (now becomes PK)
DROP INDEX IF EXISTS "user_subscription_user_id_key";

-- Drop the id column
ALTER TABLE "user_subscription" DROP COLUMN "id";

-- Add primary key on user_id
ALTER TABLE "user_subscription" ADD CONSTRAINT "user_subscription_pkey" PRIMARY KEY ("user_id");
