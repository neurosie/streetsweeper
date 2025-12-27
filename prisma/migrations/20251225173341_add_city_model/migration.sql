-- CreateTable
CREATE TABLE "City" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "stateId" TEXT NOT NULL,
    "county" TEXT,
    "population" INTEGER,
    "lat" DOUBLE PRECISION,
    "lng" DOUBLE PRECISION,
    "osmId" BIGINT NOT NULL,
    "osmType" TEXT NOT NULL DEFAULT 'relation',
    "displayName" TEXT NOT NULL,
    "populationSource" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "City_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "City_osmId_key" ON "City"("osmId");

-- CreateIndex
CREATE INDEX "City_name_stateId_idx" ON "City"("name", "stateId");

-- CreateIndex
CREATE INDEX "City_population_idx" ON "City"("population");

-- CreateIndex
CREATE INDEX "City_stateId_idx" ON "City"("stateId");
