-- CreateEnum
CREATE TYPE "AppRole" AS ENUM ('ADMIN', 'MODERATOR', 'USER');

-- CreateEnum
CREATE TYPE "BlockchainNetwork" AS ENUM ('ETHEREUM', 'POLYGON', 'SOLANA');

-- CreateEnum
CREATE TYPE "ConversionStatus" AS ENUM ('UPLOADING', 'PARSING', 'EXTRACTING', 'GENERATING', 'DEPLOYING', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "ProcessingStep" AS ENUM ('UPLOAD', 'PARSE_PDF', 'EXTRACT_DATA', 'GENERATE_CONTRACT', 'DEPLOY', 'COMPLETED');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "avatar" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_roles" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "AppRole" NOT NULL DEFAULT 'USER',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "conversions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "originalFileName" TEXT NOT NULL,
    "fileUrl" TEXT,
    "status" "ConversionStatus" NOT NULL DEFAULT 'UPLOADING',
    "processingStep" "ProcessingStep" NOT NULL DEFAULT 'UPLOAD',
    "contractType" TEXT,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "conversions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "extracted_data" (
    "id" TEXT NOT NULL,
    "conversionId" TEXT NOT NULL,
    "parties" TEXT NOT NULL,
    "contractType" TEXT NOT NULL,
    "paymentAmount" TEXT,
    "duration" TEXT,
    "obligations" TEXT NOT NULL,
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "additionalTerms" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "extracted_data_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "deployed_contracts" (
    "id" TEXT NOT NULL,
    "conversionId" TEXT NOT NULL,
    "contractAddress" TEXT NOT NULL,
    "blockchain" "BlockchainNetwork" NOT NULL,
    "transactionHash" TEXT NOT NULL,
    "solidityCode" TEXT NOT NULL,
    "compiledBytecode" TEXT,
    "deployedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "gasUsed" TEXT,
    "deploymentCost" TEXT,
    "compilerVersion" TEXT,

    CONSTRAINT "deployed_contracts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "user_roles_userId_role_key" ON "user_roles"("userId", "role");

-- CreateIndex
CREATE INDEX "conversions_userId_createdAt_idx" ON "conversions"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "conversions_status_idx" ON "conversions"("status");

-- CreateIndex
CREATE UNIQUE INDEX "extracted_data_conversionId_key" ON "extracted_data"("conversionId");

-- CreateIndex
CREATE UNIQUE INDEX "deployed_contracts_conversionId_key" ON "deployed_contracts"("conversionId");

-- CreateIndex
CREATE INDEX "deployed_contracts_contractAddress_idx" ON "deployed_contracts"("contractAddress");

-- CreateIndex
CREATE INDEX "deployed_contracts_blockchain_idx" ON "deployed_contracts"("blockchain");

-- AddForeignKey
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversions" ADD CONSTRAINT "conversions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "extracted_data" ADD CONSTRAINT "extracted_data_conversionId_fkey" FOREIGN KEY ("conversionId") REFERENCES "conversions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deployed_contracts" ADD CONSTRAINT "deployed_contracts_conversionId_fkey" FOREIGN KEY ("conversionId") REFERENCES "conversions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
