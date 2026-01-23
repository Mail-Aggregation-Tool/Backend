/*
  Warnings:

  - Added the required column `receivedAt` to the `Email` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Email" ADD COLUMN     "receivedAt" TIMESTAMP(3) NOT NULL;
