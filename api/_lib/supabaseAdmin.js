import { createClient } from '@supabase/supabase-js';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

let supabaseAdminSingleton;
let envFileCache;

function loadEnvFileMap() {
  if (envFileCache) {
    return envFileCache;
  }

  const thisDir = path.dirname(fileURLToPath(import.meta.url));
  const candidates = [
    path.resolve(process.cwd(), '.env.local'),
    path.resolve(thisDir, '../../.env.local')
  ];

  const map = {};
  for (const filePath of candidates) {
    if (!fs.existsSync(filePath)) {
      continue;
    }
    const content = fs.readFileSync(filePath, 'utf8');
    for (const line of content.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) {
        continue;
      }
      const eqIndex = trimmed.indexOf('=');
      if (eqIndex <= 0) {
        continue;
      }
      const key = trimmed.slice(0, eqIndex).trim();
      const value = trimmed.slice(eqIndex + 1).trim();
      if (key && value && map[key] === undefined) {
        map[key] = value;
      }
    }
  }

  envFileCache = map;
  return envFileCache;
}

export function getEnvValue(name, fallbackValue = null) {
  const envMap = loadEnvFileMap();
  const value = process.env[name] || envMap[name] || fallbackValue;
  return value || null;
}

function getRequiredEnv(name, fallbackValue = null) {
  const value = getEnvValue(name, fallbackValue);
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export function getSupabaseAdmin() {
  if (supabaseAdminSingleton) {
    return supabaseAdminSingleton;
  }

  const supabaseUrl = getRequiredEnv('SUPABASE_URL', getEnvValue('VITE_SUPABASE_URL'));
  const serviceRoleKey = getRequiredEnv('SUPABASE_SERVICE_ROLE_KEY');

  supabaseAdminSingleton = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });

  return supabaseAdminSingleton;
}
