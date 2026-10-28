-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "Sentiment" AS ENUM ('Bullish', 'Bearish', 'Neutral');

-- CreateTable
CREATE TABLE "NewsItem" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "link" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "publishedAt" TIMESTAMP(3) NOT NULL,
    "contentSnippet" TEXT,
    "summary" TEXT,
    "sentiment" "Sentiment",
    "impactSectors" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "actionableAdvice" TEXT,
    "analyzedAt" TIMESTAMP(3),
    "ingestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NewsItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "NewsItem_link_key" ON "NewsItem"("link");

-- CreateIndex
CREATE INDEX "NewsItem_publishedAt_idx" ON "NewsItem"("publishedAt");

-- CreateIndex
CREATE INDEX "NewsItem_sentiment_idx" ON "NewsItem"("sentiment");

-- CreateIndex
CREATE INDEX "NewsItem_source_idx" ON "NewsItem"("source");

-- CreateIndex
CREATE INDEX "NewsItem_analyzedAt_idx" ON "NewsItem"("analyzedAt");
