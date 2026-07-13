begin;

-- Ensure the new target column exists.
alter table if exists public.memories
  add column if not exists new_question_2 text;

-- If legacy column exists, migrate data and then drop it.
do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'memories'
      and column_name = 'new_prompt_text'
  ) then
    update public.memories
    set new_question_2 = coalesce(new_question_2, new_prompt_text)
    where new_prompt_text is not null;

    alter table public.memories
      drop column if exists new_prompt_text;
  end if;
end $$;

commit;
