-- Fix: "there is no unique or exclusion constraint matching the ON CONFLICT specification"
-- Problem: The trigger uses ON CONFLICT (email_id) but PostgreSQL can't match it
-- Solution: Create a unique index and reference it in ON CONFLICT

-- Step 1: Drop the broken trigger and function
DROP TRIGGER IF EXISTS email_fts_trigger ON "Email";
DROP FUNCTION IF EXISTS email_fts_update();

-- Step 2: Create a unique index on email_id (if not exists)
-- This allows ON CONFLICT to work without changing the primary key
CREATE UNIQUE INDEX IF NOT EXISTS email_fts_email_id_idx ON email_fts(email_id);

-- Step 3: Recreate the function with the fixed ON CONFLICT clause
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
  ON CONFLICT (email_id) DO UPDATE SET search_vector = EXCLUDED.search_vector;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Step 4: Recreate the trigger
CREATE TRIGGER email_fts_trigger
AFTER INSERT OR UPDATE
ON "Email"
FOR EACH ROW
EXECUTE FUNCTION email_fts_update();
