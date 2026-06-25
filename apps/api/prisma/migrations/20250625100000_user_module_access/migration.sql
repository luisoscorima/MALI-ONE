-- CreateEnum
CREATE TYPE "AppModule" AS ENUM ('links', 'workspace_users');

-- CreateTable
CREATE TABLE "UserModuleAccess" (
    "userId" TEXT NOT NULL,
    "module" "AppModule" NOT NULL,

    CONSTRAINT "UserModuleAccess_pkey" PRIMARY KEY ("userId","module")
);

-- AddForeignKey
ALTER TABLE "UserModuleAccess" ADD CONSTRAINT "UserModuleAccess_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
