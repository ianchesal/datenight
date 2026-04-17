-- AlterTable
ALTER TABLE "Movie" ADD COLUMN "streamingLastChecked" DATETIME;
ALTER TABLE "Movie" ADD COLUMN "streamingLink" TEXT;

-- CreateTable
CREATE TABLE "StreamingProvider" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "movieId" INTEGER NOT NULL,
    "providerId" INTEGER NOT NULL,
    "providerName" TEXT NOT NULL,
    CONSTRAINT "StreamingProvider_movieId_fkey" FOREIGN KEY ("movieId") REFERENCES "Movie" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "StreamingProvider_movieId_providerId_key" ON "StreamingProvider"("movieId", "providerId");
