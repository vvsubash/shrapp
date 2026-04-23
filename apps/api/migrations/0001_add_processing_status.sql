-- Add error_message column to extractions table
-- Status enum values ("processing", "failed") are enforced at app level since SQLite TEXT has no enum constraint
ALTER TABLE extractions ADD COLUMN error_message TEXT;
