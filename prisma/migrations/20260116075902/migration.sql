-- CreateTable
CREATE TABLE "event_smtp_settings" (
    "event_id" TEXT NOT NULL,
    "host" TEXT NOT NULL,
    "port" INTEGER NOT NULL,
    "secure" BOOLEAN NOT NULL DEFAULT true,
    "user" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "from_name" TEXT,
    "from_email" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "event_smtp_settings_pkey" PRIMARY KEY ("event_id")
);

-- AddForeignKey
ALTER TABLE "event_smtp_settings" ADD CONSTRAINT "event_smtp_settings_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
