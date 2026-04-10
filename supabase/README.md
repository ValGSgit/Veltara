# Supabase Setup for Veltara

This folder contains everything needed to initialize and inspect the Veltara database schema.

## What exists
- migrations/001_initial.sql: full app schema and baseline seed items
- config.toml: local Supabase CLI runtime config
- sql/inspect_schema.sql: inspection queries to verify tables, columns, indexes, and RLS

## Local setup
1. Install Supabase CLI.
2. Start local Supabase stack:
   supabase start
3. Apply migration (fresh local setup):
   supabase db reset

After reset, open Supabase Studio:
http://127.0.0.1:54323

Use:
- Table Editor to browse all tables.
- SQL Editor to run sql/inspect_schema.sql.

## Connect app locally
After supabase start, run:
  supabase status

Copy these into your .env:
- SUPABASE_URL -> API URL from status output
- SUPABASE_SERVICE_KEY -> service_role key from status output

## Remote project setup (later)
1. Link your project:
   supabase link --project-ref <your-project-ref>
2. Push migration:
   supabase db push
3. Validate schema in hosted Studio:
   https://supabase.com/dashboard/project/<your-project-ref>/editor

## Migration workflow for future changes
1. Create migration:
   supabase migration new <name>
2. Add SQL in supabase/migrations/<timestamp>_<name>.sql
3. Test locally:
   supabase db reset
4. Push to remote:
   supabase db push
