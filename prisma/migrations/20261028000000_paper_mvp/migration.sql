-- AlterTable
ALTER TABLE "NewsItem" ADD COLUMN     "analysisAttemptedAt" TIMESTAMP(3),
ADD COLUMN     "analysisError" TEXT,
ADD COLUMN     "analysisModel" TEXT,
ADD COLUMN     "analysisStatus" TEXT NOT NULL DEFAULT 'pending',
ADD COLUMN     "promptVersion" TEXT;

-- CreateTable
CREATE TABLE "PaperAccount" (
    "id" TEXT NOT NULL DEFAULT 'primary',
    "initialCash" DECIMAL(20,2) NOT NULL,
    "startDate" TEXT NOT NULL,
    "settledThrough" TEXT NOT NULL,
    "feeBps" INTEGER NOT NULL,
    "minimumFee" DECIMAL(20,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PaperAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaperInstrument" (
    "symbol" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,

    CONSTRAINT "PaperInstrument_pkey" PRIMARY KEY ("symbol")
);

-- CreateTable
CREATE TABLE "PaperCalendarDay" (
    "date" TEXT NOT NULL,
    "isOpen" BOOLEAN NOT NULL,
    "source" TEXT NOT NULL,
    "importedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PaperCalendarDay_pkey" PRIMARY KEY ("date")
);

-- CreateTable
CREATE TABLE "PaperPrice" (
    "id" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "tradeDate" TEXT NOT NULL,
    "revision" INTEGER NOT NULL,
    "close" DECIMAL(18,4) NOT NULL,
    "status" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "importedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PaperPrice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaperDecision" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "decisionDate" TEXT NOT NULL,
    "submittedAt" TIMESTAMP(3) NOT NULL,
    "kind" TEXT NOT NULL,
    "rationale" TEXT NOT NULL,
    "evidence" JSONB NOT NULL,
    "context" JSONB NOT NULL,
    "inputDigest" TEXT NOT NULL,

    CONSTRAINT "PaperDecision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaperOrder" (
    "id" TEXT NOT NULL,
    "decisionId" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "side" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "executionDate" TEXT,
    "rejectionReason" TEXT,

    CONSTRAINT "PaperOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaperTrade" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "tradeDate" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "side" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "price" DECIMAL(18,4) NOT NULL,
    "gross" DECIMAL(20,2) NOT NULL,
    "fee" DECIMAL(20,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PaperTrade_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaperAdjustment" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "eventDate" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "cashAmount" DECIMAL(20,2) NOT NULL,
    "shareDelta" INTEGER NOT NULL,
    "source" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PaperAdjustment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaperSnapshot" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "tradeDate" TEXT NOT NULL,
    "revision" INTEGER NOT NULL,
    "cash" DECIMAL(20,2) NOT NULL,
    "marketValue" DECIMAL(20,2) NOT NULL,
    "equity" DECIMAL(20,2) NOT NULL,
    "holdings" JSONB NOT NULL,
    "benchmarkClose" DECIMAL(18,4) NOT NULL,
    "missingDecision" BOOLEAN NOT NULL,
    "inputDigest" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PaperSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PaperPrice_tradeDate_idx" ON "PaperPrice"("tradeDate");

-- CreateIndex
CREATE UNIQUE INDEX "PaperPrice_symbol_tradeDate_revision_key" ON "PaperPrice"("symbol", "tradeDate", "revision");

-- CreateIndex
CREATE UNIQUE INDEX "PaperDecision_accountId_decisionDate_key" ON "PaperDecision"("accountId", "decisionDate");

-- CreateIndex
CREATE UNIQUE INDEX "PaperOrder_decisionId_symbol_key" ON "PaperOrder"("decisionId", "symbol");

-- CreateIndex
CREATE UNIQUE INDEX "PaperTrade_orderId_key" ON "PaperTrade"("orderId");

-- CreateIndex
CREATE INDEX "PaperTrade_accountId_tradeDate_idx" ON "PaperTrade"("accountId", "tradeDate");

-- CreateIndex
CREATE UNIQUE INDEX "PaperAdjustment_requestId_key" ON "PaperAdjustment"("requestId");

-- CreateIndex
CREATE INDEX "PaperAdjustment_accountId_eventDate_idx" ON "PaperAdjustment"("accountId", "eventDate");

-- CreateIndex
CREATE UNIQUE INDEX "PaperSnapshot_accountId_tradeDate_revision_key" ON "PaperSnapshot"("accountId", "tradeDate", "revision");

-- AddForeignKey
ALTER TABLE "PaperInstrument" ADD CONSTRAINT "PaperInstrument_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "PaperAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaperDecision" ADD CONSTRAINT "PaperDecision_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "PaperAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaperOrder" ADD CONSTRAINT "PaperOrder_decisionId_fkey" FOREIGN KEY ("decisionId") REFERENCES "PaperDecision"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaperTrade" ADD CONSTRAINT "PaperTrade_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "PaperAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaperTrade" ADD CONSTRAINT "PaperTrade_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "PaperOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaperAdjustment" ADD CONSTRAINT "PaperAdjustment_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "PaperAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaperSnapshot" ADD CONSTRAINT "PaperSnapshot_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "PaperAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- 旧分析没有模型或 Prompt 版本，明确标为 legacy，不伪造成功状态。
UPDATE "NewsItem" SET "analysisStatus" = 'legacy' WHERE "analyzedAt" IS NOT NULL;

-- 关键资金和数量约束同时落到数据库，防止绕过页面写入非法记录。
ALTER TABLE "PaperAccount" ADD CONSTRAINT "PaperAccount_values_check" CHECK (
  "id" = 'primary' AND "initialCash" > 0 AND "feeBps" BETWEEN 0 AND 500 AND "minimumFee" >= 0
);
ALTER TABLE "PaperOrder" ADD CONSTRAINT "PaperOrder_values_check" CHECK (
  "quantity" > 0 AND "side" IN ('BUY', 'SELL') AND "status" IN ('PENDING', 'FILLED', 'REJECTED')
);
ALTER TABLE "PaperTrade" ADD CONSTRAINT "PaperTrade_values_check" CHECK (
  "quantity" > 0 AND "price" > 0 AND "gross" >= 0 AND "fee" >= 0 AND "side" IN ('BUY', 'SELL')
);
ALTER TABLE "PaperPrice" ADD CONSTRAINT "PaperPrice_values_check" CHECK (
  "close" > 0 AND "revision" > 0 AND "status" IN ('OPEN', 'HALTED', 'LIMIT_UP', 'LIMIT_DOWN')
);
ALTER TABLE "PaperAdjustment" ADD CONSTRAINT "PaperAdjustment_values_check" CHECK (
  ("kind" = 'DIVIDEND' AND "cashAmount" > 0 AND "shareDelta" = 0)
  OR ("kind" = 'BONUS' AND "cashAmount" = 0 AND "shareDelta" > 0)
);
ALTER TABLE "PaperSnapshot" ADD CONSTRAINT "PaperSnapshot_values_check" CHECK (
  "cash" >= 0 AND "marketValue" >= 0 AND "equity" = "cash" + "marketValue" AND "benchmarkClose" > 0
);
