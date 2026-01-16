/*
  Warnings:

  - A unique constraint covering the columns `[secret]` on the table `attendances` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "attendances_secret_key" ON "attendances"("secret");
