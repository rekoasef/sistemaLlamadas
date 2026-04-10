-- Historial de cambios de estado por terminal
-- Se registra automáticamente via trigger cada vez que cambia el status
CREATE TABLE IF NOT EXISTS terminal_status_history (
    id            BIGSERIAL   PRIMARY KEY,
    terminal_id   TEXT        NOT NULL,
    status_previo TEXT,
    status_nuevo  TEXT        NOT NULL,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_terminal_status_history_terminal ON terminal_status_history (terminal_id, created_at DESC);

-- Enable Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE terminal_status_history;

-- Trigger: registrar cambio solo cuando el status realmente cambia
CREATE OR REPLACE FUNCTION log_terminal_status_change()
RETURNS TRIGGER AS $$
BEGIN
    -- INSERT inicial (terminal aparece por primera vez)
    IF TG_OP = 'INSERT' THEN
        INSERT INTO terminal_status_history (terminal_id, status_previo, status_nuevo)
        VALUES (NEW.terminal_id, NULL, NEW.status);

    -- UPDATE solo si el status cambió
    ELSIF TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status THEN
        INSERT INTO terminal_status_history (terminal_id, status_previo, status_nuevo)
        VALUES (NEW.terminal_id, OLD.status, NEW.status);
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_log_terminal_status_change
    AFTER INSERT OR UPDATE ON terminal_status
    FOR EACH ROW EXECUTE FUNCTION log_terminal_status_change();
