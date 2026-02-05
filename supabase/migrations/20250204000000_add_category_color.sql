-- Add color column to categories table for neon color theming
ALTER TABLE categories ADD COLUMN IF NOT EXISTS color TEXT DEFAULT 'neon-cyan';

-- Add check constraint for valid neon colors
ALTER TABLE categories ADD CONSTRAINT valid_neon_color CHECK (
  color IS NULL OR color IN (
    'neon-cyan',
    'neon-pink', 
    'neon-green',
    'neon-purple',
    'neon-yellow',
    'neon-orange',
    'neon-blue',
    'neon-red',
    'neon-lime',
    'neon-magenta'
  )
);
