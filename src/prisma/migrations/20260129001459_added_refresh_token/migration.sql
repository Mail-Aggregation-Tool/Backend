/*
  Warnings:

  - The primary key for the `email_fts` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - Made the column `search_vector` on table `email_fts` required. This step will fail if there are existing NULL values in that column.

*/
-- DropForeignKey
ALTER TABLE "email_fts" DROP CONSTRAINT "email_fts_email_id_fkey";

-- DropIndex
DROP INDEX "email_fts_idx";

-- AlterTable
ALTER TABLE "email_fts" DROP CONSTRAINT "email_fts_pkey",
ALTER COLUMN "search_vector" SET NOT NULL;

-- CreateTable
CREATE TABLE "RefreshToken" (
    "id" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "replacedBy" TEXT,
    "isRevoked" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "RefreshToken_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RefreshToken_userId_idx" ON "RefreshToken"("userId");

-- AddForeignKey
ALTER TABLE "RefreshToken" ADD CONSTRAINT "RefreshToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
