# Running the Supabase Migration

## Step-by-Step Instructions

1. **Open Supabase Dashboard**
   - Go to https://supabase.com/dashboard
   - Select your project

2. **Open SQL Editor**
   - Click on "SQL Editor" in the left sidebar
   - Or go to: Database → SQL Editor

3. **Create New Query**
   - Click "New Query" button

4. **Paste the Migration**
   - Open the file: `migrations/create_estimates_table.sql`
   - Copy ALL the contents (entire file)
   - Paste into the SQL Editor

5. **Run the Migration**
   - Click the "Run" button (or press Ctrl+Enter)
   - Wait for success message: "Success. No rows returned"

6. **Verify Table Creation**
   - Go to: Database → Tables
   - You should see a new table called `estimates`
   - Click on it to see the columns

## What Gets Created

✅ **estimates table** with all necessary columns  
✅ **4 indexes** for fast queries  
✅ **Auto-update trigger** for `updated_at` field  
✅ **RLS policies** (currently allows all operations)

## Troubleshooting

If you get an error:
- Make sure you're connected to the correct project
- Check if the table already exists (drop it first if needed)
- Ensure you have admin permissions

## After Migration

Once the migration runs successfully:
1. Restart your Node.js server: `node server.js`
2. Generate an estimate in the app
3. Click "💾 Save Estimate"
4. Check Supabase → Database → Tables → estimates to see your saved data
