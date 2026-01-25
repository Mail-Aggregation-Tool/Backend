-- AlterTable
ALTER TABLE "Email" ADD COLUMN     "deletedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "Email_deletedAt_idx" ON "Email"("deletedAt");
