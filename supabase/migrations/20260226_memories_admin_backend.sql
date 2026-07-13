begin;

-- 1) Create status enum (idempotent)
do $$
begin
  if not exists (
    select 1
    from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where t.typname = 'memory_status'
      and n.nspname = 'public'
  ) then
    create type public.memory_status as enum ('pending', 'approved', 'rejected');
  end if;
end $$;

-- 2) Add placeholder fields (idempotent)
alter table if exists public.memories
  add column if not exists new_question_1 text,
  add column if not exists new_prompt_text text;

-- 3) Ensure status column exists and uses enum with default/not-null
do $$
declare
  current_type text;
begin
  select a.atttypid::regtype::text
  into current_type
  from pg_attribute a
  join pg_class c on c.oid = a.attrelid
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relname = 'memories'
    and a.attname = 'status'
    and a.attnum > 0
    and not a.attisdropped;

  if current_type is null then
    alter table public.memories
      add column status public.memory_status not null default 'pending'::public.memory_status;
  else
    update public.memories
    set status = 'pending'
    where status is null
       or lower(status::text) not in ('pending', 'approved', 'rejected');

    if current_type <> 'public.memory_status' then
      alter table public.memories
        alter column status drop default;

      alter table public.memories
        alter column status type public.memory_status
        using lower(status::text)::public.memory_status;
    end if;

    alter table public.memories
      alter column status set default 'pending'::public.memory_status,
      alter column status set not null;
  end if;
end $$;

-- 4) Index for moderation list/filter
create index if not exists memories_status_created_at_idx
  on public.memories (status, created_at desc);

-- 5) Strict RLS
alter table public.memories enable row level security;
alter table public.memories force row level security;

-- 6) Drop existing policies on memories to avoid accidental exposure
do $$
declare p record;
begin
  for p in
    select policyname
    from pg_policies
    where schemaname = 'public'
      and tablename = 'memories'
  loop
    execute format('drop policy if exists %I on public.memories', p.policyname);
  end loop;
end $$;

-- 7) Public can only INSERT pending submissions
create policy memories_insert_pending_public
on public.memories
for insert
to anon, authenticated
with check (status = 'pending'::public.memory_status);

-- 8) Explicit table privileges for anon/authenticated
revoke all on table public.memories from anon, authenticated;
grant insert on table public.memories to anon, authenticated;

commit;
