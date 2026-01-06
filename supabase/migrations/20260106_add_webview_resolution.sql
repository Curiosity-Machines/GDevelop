-- Migration: Add webview resolution override to activities

ALTER TABLE activities
ADD COLUMN IF NOT EXISTS webview_resolution REAL;


