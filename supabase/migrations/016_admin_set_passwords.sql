-- 016: Admin-set password vault
--
-- Records the password an admin assigned when creating a user or changing
-- their password, so admins can view/copy it later (eye icon in Users tab).
-- NOTE: user-chosen passwords (via reset links) are never stored anywhere and
-- can never be shown — a record here goes stale if the user resets their own.
--
-- RLS is enabled with NO policies: the table is invisible to the anon and
-- authenticated API roles. Only the server's service-role key (which bypasses
-- RLS) reads or writes it, and the API returns passwords to role=admin only.

create table if not exists admin_set_passwords (
  user_id  uuid primary key,
  password text not null,
  set_by   text,
  set_at   timestamptz not null default now()
);

alter table admin_set_passwords enable row level security;
