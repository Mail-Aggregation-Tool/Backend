/*
  Warnings:

  - A unique constraint covering the columns `[uid,folder,accountId]` on the table `Email` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "Email_uid_folder_accountId_key" ON "Email"("uid", "folder", "accountId");
