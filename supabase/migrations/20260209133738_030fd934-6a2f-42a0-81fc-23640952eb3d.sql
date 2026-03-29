
-- Add ON DELETE CASCADE to all child tables referencing loads

ALTER TABLE load_stops DROP CONSTRAINT load_stops_load_id_fkey;
ALTER TABLE load_stops ADD CONSTRAINT load_stops_load_id_fkey FOREIGN KEY (load_id) REFERENCES loads(id) ON DELETE CASCADE;

ALTER TABLE payments DROP CONSTRAINT payments_load_id_fkey;
ALTER TABLE payments ADD CONSTRAINT payments_load_id_fkey FOREIGN KEY (load_id) REFERENCES loads(id) ON DELETE CASCADE;

ALTER TABLE invoices DROP CONSTRAINT invoices_load_id_fkey;
ALTER TABLE invoices ADD CONSTRAINT invoices_load_id_fkey FOREIGN KEY (load_id) REFERENCES loads(id) ON DELETE CASCADE;

ALTER TABLE pod_documents DROP CONSTRAINT pod_documents_load_id_fkey;
ALTER TABLE pod_documents ADD CONSTRAINT pod_documents_load_id_fkey FOREIGN KEY (load_id) REFERENCES loads(id) ON DELETE CASCADE;
