-- Same rules as 0001/0004 for the new due_payments table: no DELETE/TRUNCATE, voided rows frozen.
CREATE TRIGGER due_payments_no_delete BEFORE DELETE ON due_payments FOR EACH ROW EXECUTE FUNCTION forbid_delete();
--> statement-breakpoint
CREATE TRIGGER due_payments_no_truncate BEFORE TRUNCATE ON due_payments FOR EACH STATEMENT EXECUTE FUNCTION forbid_delete();
--> statement-breakpoint
CREATE TRIGGER due_payments_frozen_when_voided BEFORE UPDATE ON due_payments FOR EACH ROW EXECUTE FUNCTION forbid_change_when_voided();
