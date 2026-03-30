-- Phase 19: Add testMode and onboardingCompleted to User table
ALTER TABLE "User" ADD COLUMN "testMode" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "User" ADD COLUMN "onboardingCompleted" BOOLEAN NOT NULL DEFAULT false;
