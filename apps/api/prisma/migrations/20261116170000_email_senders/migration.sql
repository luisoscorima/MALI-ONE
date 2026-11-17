CREATE TABLE "EmailSender" (
  "id" TEXT NOT NULL,
  "email" VARCHAR(320) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "EmailSender_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "EmailSender_email_key" ON "EmailSender"("email");

INSERT INTO "EmailSender" ("id", "email", "createdAt", "updatedAt")
VALUES (
  'email_sender_boletines_mali_pe',
  'boletines@mali.pe',
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
)
ON CONFLICT ("email") DO NOTHING;
