-- Supabase Storage Setup for Art Portfolio
-- The bucket already exists, so we'll just set up the policies

-- 1. Enable RLS on storage.objects (if not already enabled)
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- 2. Drop existing policies if they exist (to avoid conflicts)
DROP POLICY IF EXISTS "Allow public read access" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated upload" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated update" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated delete" ON storage.objects;

-- 3. Create storage policies for the artworks bucket

-- Policy 1: Allow public read access to artworks
CREATE POLICY "Allow public read access" ON storage.objects
FOR SELECT USING (bucket_id = 'artworks');

-- Policy 2: Allow authenticated users to upload
CREATE POLICY "Allow authenticated upload" ON storage.objects
FOR INSERT WITH CHECK (
  bucket_id = 'artworks' 
  AND auth.role() = 'authenticated'
);

-- Policy 3: Allow authenticated users to update their uploads
CREATE POLICY "Allow authenticated update" ON storage.objects
FOR UPDATE USING (
  bucket_id = 'artworks' 
  AND auth.role() = 'authenticated'
);

-- Policy 4: Allow authenticated users to delete their uploads
CREATE POLICY "Allow authenticated delete" ON storage.objects
FOR DELETE USING (
  bucket_id = 'artworks' 
  AND auth.role() = 'authenticated'
);

-- 5. Verify the artworks table exists and has proper policies
-- If not, uncomment and run this:
/*
CREATE TABLE IF NOT EXISTS artworks (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  medium TEXT,
  year INTEGER,
  dimensions TEXT,
  description TEXT,
  image_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS on artworks table
ALTER TABLE artworks ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Allow public read access" ON artworks;
DROP POLICY IF EXISTS "Allow authenticated insert" ON artworks;
DROP POLICY IF EXISTS "Allow authenticated update" ON artworks;
DROP POLICY IF EXISTS "Allow authenticated delete" ON artworks;

-- Allow public read access to artworks
CREATE POLICY "Allow public read access" ON artworks
FOR SELECT USING (true);

-- Allow authenticated users to insert artworks
CREATE POLICY "Allow authenticated insert" ON artworks
FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- Allow authenticated users to update artworks
CREATE POLICY "Allow authenticated update" ON artworks
FOR UPDATE USING (auth.role() = 'authenticated');

-- Allow authenticated users to delete artworks
CREATE POLICY "Allow authenticated delete" ON artworks
FOR DELETE USING (auth.role() = 'authenticated');
*/

-- 6. Verify setup
SELECT 
  'Storage policies setup complete' as status,
  name,
  public
FROM storage.buckets 
WHERE name = 'artworks';
