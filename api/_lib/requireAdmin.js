import { getEnvValue, getSupabaseAdmin } from './supabaseAdmin.js';

function json(res, status, body) {
  return res.status(status).json(body);
}

function parseBearerToken(req) {
  const authHeader = req.headers?.authorization || req.headers?.Authorization;
  if (!authHeader || typeof authHeader !== 'string') {
    return null;
  }

  const [scheme, token] = authHeader.split(' ');
  if (!scheme || !token || scheme.toLowerCase() !== 'bearer') {
    return null;
  }

  return token;
}

function getAdminAllowlist() {
  const raw = getEnvValue('ADMIN_EMAIL_ALLOWLIST');
  if (!raw || typeof raw !== 'string') {
    return null;
  }

  const emails = raw
    .split(',')
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);

  return emails.length > 0 ? emails : null;
}

export async function requireAdmin(req, res) {
  const token = parseBearerToken(req);
  if (!token) {
    json(res, 401, { error: 'unauthorized', message: 'Missing or invalid bearer token.' });
    return null;
  }

  let supabase;
  try {
    supabase = getSupabaseAdmin();
  } catch (error) {
    json(res, 500, { error: 'server_misconfigured', message: error.message });
    return null;
  }

  const allowlist = getAdminAllowlist();
  if (!allowlist) {
    json(res, 500, {
      error: 'server_misconfigured',
      message: 'Missing or empty ADMIN_EMAIL_ALLOWLIST.'
    });
    return null;
  }

  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data?.user) {
    json(res, 401, { error: 'unauthorized', message: 'Invalid or expired token.' });
    return null;
  }

  const email = data.user.email?.toLowerCase();
  if (!email || !allowlist.includes(email)) {
    json(res, 403, { error: 'forbidden', message: 'User is not an allowed admin.' });
    return null;
  }

  return { supabase, user: data.user };
}
