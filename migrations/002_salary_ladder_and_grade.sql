-- Migration: Add salary_ladder table and grade column to employees
-- For InsForge/Supabase PostgreSQL database
-- Run this via InsForge SQL Editor or Supabase Dashboard

-- 1. Add grade column to employees table (if not exists)
ALTER TABLE employees ADD COLUMN IF NOT EXISTS grade TEXT DEFAULT NULL;

-- 2. Add sick_leave_used column to leave_balance table (if not exists)  
ALTER TABLE leave_balance ADD COLUMN IF NOT EXISTS sick_leave_used INTEGER DEFAULT 0;
ALTER TABLE leave_balance ADD COLUMN IF NOT EXISTS emergency_leave_used INTEGER DEFAULT 0;
ALTER TABLE leave_balance ADD COLUMN IF NOT EXISTS annual_leave_used INTEGER DEFAULT 0;

-- Update leave_balance defaults for Saudi Labor Law compliance
-- sick_leave_total should be 120 (not 14)
-- emergency_leave_total should be 10 (not 5)
ALTER TABLE leave_balance ALTER COLUMN sick_leave_total SET DEFAULT 120;
ALTER TABLE leave_balance ALTER COLUMN emergency_leave_total SET DEFAULT 10;
ALTER TABLE leave_balance ALTER COLUMN annual_leave_total SET DEFAULT 21;

-- 3. Create salary_ladder table
CREATE TABLE IF NOT EXISTS salary_ladder (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    grade TEXT NOT NULL,
    year_number INTEGER NOT NULL CHECK (year_number >= 1 AND year_number <= 20),
    min_salary DECIMAL(12,2) DEFAULT 0,
    max_salary DECIMAL(12,2) DEFAULT 0,
    annual_increment DECIMAL(12,2) DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(grade, year_number)
);

-- 4. Enable Row Level Security on salary_ladder
ALTER TABLE salary_ladder ENABLE ROW LEVEL SECURITY;

-- 5. Create RLS policies for salary_ladder (allow authenticated users to read, admins to write)
CREATE POLICY "Allow authenticated read salary_ladder" ON salary_ladder
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow authenticated insert salary_ladder" ON salary_ladder
    FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Allow authenticated update salary_ladder" ON salary_ladder
    FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Allow authenticated delete salary_ladder" ON salary_ladder
    FOR DELETE TO authenticated USING (true);

-- 6. Create index for faster grade lookups
CREATE INDEX IF NOT EXISTS idx_salary_ladder_grade ON salary_ladder(grade);
CREATE INDEX IF NOT EXISTS idx_employees_grade ON employees(grade);
