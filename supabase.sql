-- شغّل هذا الملف كاملًا داخل Supabase SQL Editor.
create extension if not exists pgcrypto;

create table if not exists public.memorials(
 id uuid primary key default gen_random_uuid(),
 name text not null check (char_length(trim(name)) between 1 and 120),
 created_at timestamptz not null default now()
);

create table if not exists public.quran_parts(
 id uuid primary key default gen_random_uuid(),
 memorial_id uuid not null references public.memorials(id) on delete cascade,
 part_number int not null check(part_number between 1 and 30),
 part_name text not null,
 reading_count int not null default 0 check(reading_count>=0),
 reserved_by uuid null,
 reserved_until timestamptz null,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 unique(memorial_id,part_number)
);

alter table public.memorials enable row level security;
alter table public.quran_parts enable row level security;

drop policy if exists "public read memorials" on public.memorials;
create policy "public read memorials" on public.memorials for select to anon,authenticated using (true);

drop policy if exists "public read parts" on public.quran_parts;
create policy "public read parts" on public.quran_parts for select to anon,authenticated using (true);

create or replace function public.create_memorial(p_name text)
returns uuid language plpgsql security definer set search_path=public as $$
declare mid uuid;
begin
 insert into memorials(name) values(trim(p_name)) returning id into mid;
 insert into quran_parts(memorial_id,part_number,part_name)
 select mid,n,'الجزء '||n from generate_series(1,30) n;
 return mid;
end $$;

create or replace function public.reserve_part(p_part_id uuid)
returns boolean language plpgsql security definer set search_path=public as $$
declare ok boolean;
begin
 update quran_parts
 set reserved_by=auth.uid(), reserved_until=now()+interval '5 hours', updated_at=now()
 where id=p_part_id and (reserved_until is null or reserved_until<=now());
 get diagnostics ok = row_count > 0;
 return ok;
end $$;

create or replace function public.cancel_reservation(p_part_id uuid)
returns boolean language plpgsql security definer set search_path=public as $$
begin
 update quran_parts set reserved_by=null,reserved_until=null,updated_at=now()
 where id=p_part_id and reserved_by=auth.uid() and reserved_until>now();
 return found;
end $$;

create or replace function public.complete_part(p_part_id uuid)
returns boolean language plpgsql security definer set search_path=public as $$
begin
 update quran_parts
 set reading_count=reading_count+1,reserved_by=null,reserved_until=null,updated_at=now()
 where id=p_part_id and reserved_by=auth.uid() and reserved_until>now();
 return found;
end $$;

create or replace view public.memorial_summary as
select m.id,m.name,m.created_at,
 coalesce(sum(q.reading_count),0)::int as total_readings,
 coalesce(sum(case when q.reading_count>0 then 1 else 0 end),0)::int as parts_read,
 coalesce(min(q.reading_count),0)::int as khatmas
from memorials m left join quran_parts q on q.memorial_id=m.id
group by m.id,m.name,m.created_at;

grant usage on schema public to anon,authenticated;
grant select on public.memorials,public.quran_parts to anon,authenticated;
grant execute on function public.create_memorial(text) to anon,authenticated;
grant execute on function public.reserve_part(uuid) to anon,authenticated;
grant execute on function public.cancel_reservation(uuid) to anon,authenticated;
grant execute on function public.complete_part(uuid) to anon,authenticated;
grant select on public.memorial_summary to anon,authenticated;

-- أسماء الأجزاء بالعربية
update quran_parts set part_name = case part_number
when 1 then 'الجزء الأول' when 2 then 'الجزء الثاني' when 3 then 'الجزء الثالث'
when 4 then 'الجزء الرابع' when 5 then 'الجزء الخامس' when 6 then 'الجزء السادس'
when 7 then 'الجزء السابع' when 8 then 'الجزء الثامن' when 9 then 'الجزء التاسع'
when 10 then 'الجزء العاشر' when 11 then 'الجزء الحادي عشر' when 12 then 'الجزء الثاني عشر'
when 13 then 'الجزء الثالث عشر' when 14 then 'الجزء الرابع عشر' when 15 then 'الجزء الخامس عشر'
when 16 then 'الجزء السادس عشر' when 17 then 'الجزء السابع عشر' when 18 then 'الجزء الثامن عشر'
when 19 then 'الجزء التاسع عشر' when 20 then 'الجزء العشرون' when 21 then 'الجزء الحادي والعشرون'
when 22 then 'الجزء الثاني والعشرون' when 23 then 'الجزء الثالث والعشرون' when 24 then 'الجزء الرابع والعشرون'
when 25 then 'الجزء الخامس والعشرون' when 26 then 'الجزء السادس والعشرون' when 27 then 'الجزء السابع والعشرون'
when 28 then 'الجزء الثامن والعشرون' when 29 then 'الجزء التاسع والعشرون' when 30 then 'الجزء الثلاثون'
end;
