-- 017: Follow-up scheduling on leads and opportunities
--
-- A single optional calendar date per record ("next time to follow up"),
-- set in the edit forms via a date picker or quick +days/+weeks shortcuts.
-- Additive only — safe to run on production at any time.

alter table opportunities add column if not exists follow_up_at date;
alter table leads         add column if not exists follow_up_at date;
