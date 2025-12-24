-- CreateTable
CREATE TABLE "Search" (
    "query" TEXT NOT NULL,
    "results" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Search_pkey" PRIMARY KEY ("query")
);
