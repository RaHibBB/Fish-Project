-- Same rules as 0001 for the new tables: no DELETE/TRUNCATE, voided rows frozen.
-- push_subscriptions is intentionally excluded (expired device subscriptions are removed).
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['ponds','sales','feedings'] LOOP
    EXECUTE format('CREATE TRIGGER %I BEFORE DELETE ON %I FOR EACH ROW EXECUTE FUNCTION forbid_delete()', t || '_no_delete', t);
    EXECUTE format('CREATE TRIGGER %I BEFORE TRUNCATE ON %I FOR EACH STATEMENT EXECUTE FUNCTION forbid_delete()', t || '_no_truncate', t);
  END LOOP;
  FOREACH t IN ARRAY ARRAY['sales','feedings'] LOOP
    EXECUTE format('CREATE TRIGGER %I BEFORE UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION forbid_change_when_voided()', t || '_frozen_when_voided', t);
  END LOOP;
END $$;
