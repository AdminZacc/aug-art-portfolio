# aug-art-portfolio

Static Art Portfolio (Static + Supabase backend)

Static front-end hosted on GitHub Pages + Supabase backend for artwork data.

## Quick Start

1. Create a Supabase project (free tier) and new table `artworks`:

| column       | type      | notes                       |
|--------------|-----------|-----------------------------|
| id           | uuid      | primary key default uuid()  |
| title        | text      |                             |
| image_url    | text      | direct image URL            |
| description  | text      |                             |
| created_at   | timestamp | default now()               |

SQL helper:

```sql
create table if not exists public.artworks (

  id uuid primary key default gen_random_uuid(),
  title text,

  image_url text,
  description text,
  created_at timestamp with time zone default now()
);

```

1. Copy `config.example.js` to `config.js` and fill in:

```js
window.SUPABASE_CONFIG = {

  url: "https://YOUR_PROJECT_ID.supabase.co",
  anonKey: "YOUR_PUBLIC_ANON_KEY"
};
```


Do NOT commit service_role keys.

1. Open `index.html` in a browser (or use a local web server). You should see artworks load.

## GitHub Pages Deployment

1. Push repository to GitHub.
2. In GitHub repo: Settings → Pages → (Branch: `main` / root) → Save.
3. Wait for build; site will be at `https://<username>.github.io/<repo>/`.
4. If using a custom domain: add `CNAME` file with domain and configure DNS (A / ALIAS or CNAME to `username.github.io`).

## Updating Data

Add rows manually in Supabase Table Editor or use SQL / REST / SDK. The site fetches on load and when Refresh is clicked.


## Security Notes

- Public anon key is safe to expose; it is row-level-security (RLS) + policies that protect data.
- Consider enabling RLS and adding read-only policy for `artworks` table like:

```sql
alter table public.artworks enable row level security;
create policy "Public read" on public.artworks for select using ( true );
```

## Future Enhancements

- Pagination or infinite scroll
- Lightbox modal for images
- Admin upload page (secured via Supabase Auth)
- Caching layer (localStorage) for offline viewing

## Admin Panel

An `admin.html` + `admin.js` panel lets you:

- Sign in with Supabase email/password (create users via dashboard)
- Upload an image file (stored in storage bucket `artworks`) OR supply external URL
- Insert new artwork row
- List and delete existing artworks

Requirements:

1. Create storage bucket named `artworks` (public)
2. (Optional) Make uploads public via policy or just use bucket public toggle
3. Enable RLS on `artworks` table then add policies:

```sql
-- Allow read to everyone
create policy "Public read" on public.artworks for select using ( true );

-- Allow inserts / deletes only to authenticated users
create policy "Auth insert" on public.artworks for insert with check ( auth.role() = 'authenticated' );
create policy "Auth delete" on public.artworks for delete using ( auth.role() = 'authenticated' );
```

Storage bucket policies (if not using public bucket):

```sql
-- Read objects in artworks bucket
create policy "Public storage read" on storage.objects for select using (
  bucket_id = 'artworks'
);
-- Authenticated users can insert
create policy "Auth storage insert" on storage.objects for insert with check (
  bucket_id = 'artworks' and auth.role() = 'authenticated'
);
```

Add users manually (Authentication → Users) so only you can log in.

## Offline & Service Worker

The project includes a basic service worker (`sw.js`) providing:

- Pre-cached core shell: index, styles, scripts, admin, offline page
- Cache-first strategy for images with LRU trimming (70 images)
- Stale-while-revalidate for Supabase `artworks` GET requests (REST endpoint containing `/rest/v1/artworks`)
- Network-first navigation fallback to `offline.html` when offline
- Runtime caching for same-origin static GET requests

To update the service worker after edits, bump `SW_VERSION` in `sw.js` and deploy; the new worker will activate and old caches pruned.

Note: If hosting under a repo subpath (GitHub Pages), adjust `PRECACHE_ASSETS` and registration path (e.g., use `navigator.serviceWorker.register('./sw.js')`).

## License

MIT
