# Supabase Row-Level Security (RLS) Setup Guide

## Why Enable RLS?

Currently, your Supabase database tables are accessible to anyone with your ANON key. While you've secured the key using environment variables, it's still exposed in the frontend if used there. RLS adds an additional security layer by controlling data access at the database level.

## Steps to Enable RLS

### 1. Access Supabase Dashboard

1. Go to [https://supabase.com/dashboard](https://supabase.com/dashboard)
2. Select your project: `tbocpyixeobyfnvdmicm`
3. Navigate to **Authentication** → **Policies**

### 2. Enable RLS for Each Table

For each of these tables, enable RLS:
- `structure`
- `special_structure`
- `materials`
- `labour`

### 3. Create Policies

#### For Public Read Access (All Tables)

If your estimator is public and anyone can view estimates:

```sql
-- Allow public read access
CREATE POLICY "Public read access" ON structure
    FOR SELECT
    USING (true);

CREATE POLICY "Public read access" ON special_structure
    FOR SELECT
    USING (true);

CREATE POLICY "Public read access" ON materials
    FOR SELECT
    USING (true);

CREATE POLICY "Public read access" ON labour
    FOR SELECT
    USING (true);
```

#### For Authenticated Write Access (structure tables)

If only authenticated admin users should modify structures:

```sql
-- Allow authenticated users to insert/update/delete
CREATE POLICY "Authenticated write access" ON structure
    FOR ALL
    USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated write access" ON special_structure
    FOR ALL
    USING (auth.role() = 'authenticated');
```

#### For Service Role Only (materials/labour)

If materials and labour should only be modified by service role:

```sql
-- Service role only for materials and labour
CREATE POLICY "Service role only" ON materials
    FOR ALL
    USING (auth.role() = 'service_role');

CREATE POLICY "Service role only" ON labour
    FOR ALL
    USING (auth.role() = 'service_role');
```

### 4. Alternative: API-Based Access

If you want all access to go through your Express server:

```sql
-- Block all direct access, force through API
CREATE POLICY "API only access" ON structure
    FOR ALL
    USING (false);

-- Then use service role key in your backend
-- Update supabase-config.js to use SUPABASE_SERVICE_ROLE_KEY
```

## Recommended Configuration

For your use case (public estimator + admin panel):

1. **Enable RLS on all tables**
2. **Public read for materials/labour** (used in estimates)
3. **Authenticated write for structures** (admin panel requires login)
4. **Consider adding Supabase Auth** to your admin panel

## Testing RLS Policies

After setting up policies:

1. Test GET endpoints - should work
2. Test POST/DELETE - may fail if auth not configured
3. Update your server to use service role key for admin operations
4. Implement authentication in admin panel if needed

## Next Steps

- [ ] Enable RLS on all 4 tables
- [ ] Create appropriate policies based on your access requirements
- [ ] Test all API endpoints
- [ ] Consider implementing Supabase Auth for admin users
