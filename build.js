const fs   = require('fs');
const path = require('path');

let url  = '';
let anon = '';

// Try to read credentials from local .env file
const localEnvPath = path.join(__dirname, '.env');
const parentEnvPath = path.join(__dirname, '..', '.env');
let envPath = '';

if (fs.existsSync(localEnvPath)) {
  envPath = localEnvPath;
} else if (fs.existsSync(parentEnvPath)) {
  envPath = parentEnvPath;
}

if (envPath) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  envContent.split('\n').forEach(line => {
    const parts = line.split('=');
    if (parts.length >= 2) {
      const key = parts[0].trim();
      const val = parts.slice(1).join('=').trim().replace(/^['"]|['"]$/g, '');
      if (key === 'SUPABASE_URL') url = val;
      if (key === 'SUPABASE_ANON_KEY' || key === 'SUPABASE_ANON') anon = val;
    }
  });
}

// Fallback to process.env (Vercel environment variables)
if (!url) url = process.env.SUPABASE_URL || '';
if (!anon) anon = process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_ANON || '';

// Fallback to dummy credentials for local previewing if not set
if (!url || !anon) {
  console.warn('⚠️  Supabase credentials missing.');
  console.warn('    For cloud database features, create a file named .env in your root directory and add:');
  console.log('    SUPABASE_URL=your_supabase_url');
  console.log('    SUPABASE_ANON_KEY=your_supabase_anon_key');
  console.warn('    Falling back to dummy credentials for local previewing...');
  url = 'https://dummy.supabase.co';
  anon = 'dummy_anon_key';
}

console.log('✓  SUPABASE_URL       =', url.slice(0, 40) + (url.length > 40 ? '…' : ''));
console.log('✓  SUPABASE_ANON_KEY  =', anon.slice(0, 24) + '…');

fs.mkdirSync(path.join(__dirname, 'dist'), { recursive: true });

// Compile all HTML files in the root folder
const rootFiles = fs.readdirSync(__dirname);
const excludeFiles = ['indexcombined.html', 'inventory_dashboard.html'];

rootFiles.forEach(file => {
  if (file.endsWith('.html') && !excludeFiles.includes(file)) {
    const srcPath = path.join(__dirname, file);
    const destPath = path.join(__dirname, 'dist', file);
    
    const src = fs.readFileSync(srcPath, 'utf8');
    const out = src
      .replace("'__SUPABASE_URL__';",  JSON.stringify(url) + ';')
      .replace("'__SUPABASE_ANON__';", JSON.stringify(anon) + ';');
      
    fs.writeFileSync(destPath, out, 'utf8');
    console.log(`✓  Built dist/${file} — Supabase credentials injected successfully`);
  }
});

