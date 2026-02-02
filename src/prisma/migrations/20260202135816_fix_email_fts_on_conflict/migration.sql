-- 1. Ensure the table has the correct structure
-- If email_id isn't a Primary Key anymore, we make it one.
-- A Primary Key automatically creates the Unique Index Postgres needs.
ALTER TABLE "email_fts" 
ADD CONSTRAINT "email_fts_pkey" PRIMARY KEY ("email_id");

-- 2. Re-establish the Foreign Key (since it was dropped)
ALTER TABLE "email_fts" 
ADD CONSTRAINT "email_fts_email_id_fkey" 
FOREIGN KEY ("email_id") REFERENCES "Email"("id") ON DELETE CASCADE;

-- 3. Drop and Recreate the Function to be 100% sure it matches the PK
CREATE OR REPLACE FUNCTION email_fts_update() RETURNS trigger AS $$
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
    -- This "email_id" MUST match the column name in the PRIMARY KEY above
    ON CONFLICT (email_id) 
    DO UPDATE SET search_vector = EXCLUDED.search_vector;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 4. Re-enable the Trigger
DROP TRIGGER IF EXISTS email_fts_trigger ON "Email";
CREATE TRIGGER email_fts_trigger
AFTER INSERT OR UPDATE
ON "Email"
FOR EACH ROW
EXECUTE FUNCTION email_fts_update();