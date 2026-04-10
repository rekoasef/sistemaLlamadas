-- Terminal status table: tracks online/offline state of each mobile terminal
-- Updated via heartbeat every 15 min from the Android app
CREATE TABLE IF NOT EXISTS terminal_status (
    terminal_id  TEXT        PRIMARY KEY,
    status       TEXT        NOT NULL DEFAULT 'OFFLINE',
    last_seen    TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Auto-update updated_at on every upsert
CREATE OR REPLACE FUNCTION update_terminal_status_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_terminal_status_updated_at
    BEFORE UPDATE ON terminal_status
    FOR EACH ROW EXECUTE FUNCTION update_terminal_status_timestamp();

-- Enable Realtime so the frontend receives live updates
ALTER PUBLICATION supabase_realtime ADD TABLE terminal_status;

-- pg_cron: mark terminals as OFFLINE if last_seen > 20 minutes ago
-- Runs every 5 minutes
SELECT cron.schedule(
    'mark-offline-terminals',
    '*/5 * * * *',
    $$
        UPDATE terminal_status
        SET status = 'OFFLINE'
        WHERE last_seen < now() - interval '20 minutes'
          AND status = 'ONLINE';
    $$
);
