-- Fix #1: Make driver-documents bucket private to protect sensitive files
UPDATE storage.buckets SET public = false WHERE id = 'driver-documents';
