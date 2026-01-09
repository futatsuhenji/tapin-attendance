/*
  Warnings:

  - The values [UNSENT] on the enum `ATTENDANCE_TYPE` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "ATTENDANCE_TYPE_new" AS ENUM ('PRESENCE', 'PRESENCE_PARTIALLY', 'ABSENCE', 'UNANSWERED');
ALTER TABLE "attendances" ALTER COLUMN "attendance" TYPE "ATTENDANCE_TYPE_new" USING ("attendance"::text::"ATTENDANCE_TYPE_new");
ALTER TYPE "ATTENDANCE_TYPE" RENAME TO "ATTENDANCE_TYPE_old";
ALTER TYPE "ATTENDANCE_TYPE_new" RENAME TO "ATTENDANCE_TYPE";
DROP TYPE "public"."ATTENDANCE_TYPE_old";
COMMIT;
