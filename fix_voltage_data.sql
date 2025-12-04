-- SQL Query to fix malformed voltage data in 'structures' table
-- Problem: Data is stored as a single-element array containing a string representation of an array.
-- Example Current: {"{DTR,\"33 kV\",\"11 kV\"}"}
-- Example Desired: {"DTR","33 kV","11 kV"}

-- 1. Check the current data (Optional, to verify)
SELECT id, voltage FROM structures LIMIT 5;

-- 2. Update the data
-- This query takes the first element of the array (which is the string "{...}"),
-- casts it to a text array, and updates the column.
UPDATE structures
SET voltage = (voltage[1])::text[]
WHERE array_length(voltage, 1) = 1  -- Only target rows with 1 element
  AND voltage[1] LIKE '{%';         -- And that element looks like an array string

-- 3. Verify the update
SELECT id, voltage FROM structures LIMIT 5;
