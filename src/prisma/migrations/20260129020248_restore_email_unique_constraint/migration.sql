/*
  Warnings:

  - A unique constraint covering the columns `[accountId,uid,folder]` on the table `Email` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "Email_accountId_uid_folder_key" ON "Email"("accountId", "uid", "folder");
