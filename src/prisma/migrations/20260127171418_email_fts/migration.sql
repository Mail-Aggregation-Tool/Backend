CREATE TABLE email_fts (
  email_id TEXT PRIMARY KEY REFERENCES "Email"(id) ON DELETE CASCADE,
  search_vector tsvector
);
INSERT INTO email_fts (email_id, search_vector)

SELECT
  id,
  to_tsvector(
    'english',
    coalesce(subject, '') || ' ' ||
    coalesce(body, '') || ' ' ||
    coalesce("from", '')
  )
FROM "Email";

CREATE FUNCTION email_fts_update() RETURNS trigger AS $$
BEGIN
  INSERT INTO email_fts (email_id, search_vector)
  VALUES (
    NEW.id,
    to_tsvector(
      'english',
      coalesce(NEW.subject, '') || ' ' ||
      coalesce(NEW.body, '') || ' ' ||
      coalesce(NEW."from", '')
    )
  )
  ON CONFLICT (email_id)
  DO UPDATE SET search_vector = EXCLUDED.search_vector;

  RETURN NEW;
END;

$$ LANGUAGE plpgsql;
CREATE TRIGGER email_fts_trigger
AFTER INSERT OR UPDATE
ON "Email"
FOR EACH ROW
EXECUTE FUNCTION email_fts_update();

CREATE INDEX email_fts_idx
ON email_fts
USING GIN (search_vector);