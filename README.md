# Bouldering Tracker

A simple, single-page web app for tracking bouldering attempts, sends, and progression over time.

## Features

- Supabase Auth (email magic link) for sign-in/sign-out
- Cloud-synced climbs scoped to each signed-in user
- Sync status indicator (`Signed out`, `Signing in...`, `Syncing...`, `Synced`, `Error`)
- Add one entry per climb attempt
- Required field validation for date and problem name
- Filter by grade
- Toggle to show sent climbs only
- Search climbs by problem name (case-insensitive)
- Sort by newest, oldest, highest grade, or most attempts
- Inline edit for existing entries
- Delete single entries or clear all data
- Export current dataset to JSON or CSV (backup)
- Lightweight local preference persistence for `lastGym`
- Works as a static app (including GitHub Pages)

## Project Structure

- `index.html` – semantic page structure and UI sections, including auth/sync controls
- `styles.css` – responsive styling for auth state, sync status, form, stats, and table
- `app.js` – Supabase auth/data sync, rendering, filtering/sorting, and export utilities

## Supabase Setup

1. Create a new Supabase project.
2. In Supabase, open **SQL Editor** and run:

```sql
create extension if not exists pgcrypto;

create table if not exists public.climbs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  date date not null,
  gym text not null default '',
  problem text not null,
  grade text not null,
  attempts integer not null check (attempts >= 1),
  sent boolean not null default false,
  style text not null default 'vertical',
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists climbs_user_id_idx on public.climbs (user_id);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_climbs_updated_at on public.climbs;
create trigger set_climbs_updated_at
before update on public.climbs
for each row
execute function public.set_updated_at();
```

3. In **Authentication** → **Providers** → **Email**, enable Email provider and magic links.
4. In **Authentication** → **URL Configuration**, set your site URL (for example your GitHub Pages URL) and add redirect URLs for local dev and production.
5. Enable Row Level Security and add per-user policies:

```sql
alter table public.climbs enable row level security;

create policy "Users can select their own climbs"
on public.climbs
for select
to authenticated
using (auth.uid() = user_id);

create policy "Users can insert their own climbs"
on public.climbs
for insert
to authenticated
with check (auth.uid() = user_id);

create policy "Users can update their own climbs"
on public.climbs
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "Users can delete their own climbs"
on public.climbs
for delete
to authenticated
using (auth.uid() = user_id);
```

## App Configuration

1. In Supabase, copy:
   - **Project URL**
   - **anon public key**
2. Open `app.js` and update the config block at the top:

```js
const SUPABASE_URL = 'https://YOUR_PROJECT.supabase.co';
const SUPABASE_ANON_KEY = 'YOUR_SUPABASE_ANON_KEY';
```

3. Save and redeploy.

## Run Locally

No install step is required.

1. Clone or download this repository.
2. Set `SUPABASE_URL` and `SUPABASE_ANON_KEY` in `app.js`.
3. Open `index.html` in your browser.

## Deploy with GitHub Pages

1. Push this repository to GitHub.
2. Go to **Settings** → **Pages**.
3. Under **Build and deployment**:
   - Set **Source** to **Deploy from a branch**
   - Select your branch (for example `main`) and folder `/ (root)`
4. Save.
5. After a minute, GitHub will provide a live URL to your app.
6. In Supabase Auth URL settings, make sure this deployed URL is listed in allowed URLs.
