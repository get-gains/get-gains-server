-- DropIndex
DROP INDEX "coach_invitation_code_status_idx";

-- RenameIndex
ALTER INDEX "standalone_performed_set_session_id_routine_exercise_d_key" RENAME TO "standalone_performed_set_session_id_routine_exercise_id_set_key";
