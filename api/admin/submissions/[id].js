import { requireAdmin } from '../../_lib/requireAdmin.js';

const SELECT_COLUMNS = [
  'id',
  'created_at',
  'name',
  'email',
  'title',
  'audio_url',
  'status',
  'new_question_1',
  'new_question_2'
].join(',');

const PATCHABLE_STATUSES = new Set(['approved', 'rejected']);
const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function getIdFromRequest(req) {
  const raw = req.query?.id;
  if (Array.isArray(raw)) {
    return raw[0];
  }
  return raw;
}

function isValidUuid(value) {
  return typeof value === 'string' && UUID_REGEX.test(value);
}

function parsePatchBody(body) {
  if (body && typeof body === 'object') {
    return body;
  }
  if (typeof body === 'string' && body.length > 0) {
    try {
      return JSON.parse(body);
    } catch {
      return null;
    }
  }
  return null;
}

export default async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'PATCH') {
    res.setHeader('Allow', 'GET, PATCH');
    return res.status(405).json({ error: 'method_not_allowed', message: 'Method not allowed.' });
  }

  const auth = await requireAdmin(req, res);
  if (!auth) {
    return;
  }
  const { supabase } = auth;

  const id = getIdFromRequest(req);
  if (!isValidUuid(id)) {
    return res.status(400).json({ error: 'invalid_id', message: 'id must be a valid UUID.' });
  }

  if (req.method === 'GET') {
    const { data, error } = await supabase
      .from('memories')
      .select(SELECT_COLUMNS)
      .eq('id', id)
      .maybeSingle();

    if (error) {
      return res
        .status(500)
        .json({ error: 'db_error', message: error.message || 'Failed to fetch submission.' });
    }

    if (!data) {
      return res.status(404).json({ error: 'not_found', message: 'Submission not found.' });
    }

    return res.status(200).json({ data });
  }

  const payload = parsePatchBody(req.body);
  if (!payload || typeof payload.status !== 'string') {
    return res.status(400).json({
      error: 'invalid_body',
      message: "Body must be JSON with a string 'status' field."
    });
  }

  const status = payload.status.toLowerCase();
  if (!PATCHABLE_STATUSES.has(status)) {
    return res.status(400).json({
      error: 'invalid_status',
      message: "status must be one of: approved, rejected."
    });
  }

  const { data, error } = await supabase
    .from('memories')
    .update({ status })
    .eq('id', id)
    .select(SELECT_COLUMNS)
    .maybeSingle();

  if (error) {
    return res
      .status(500)
      .json({ error: 'db_error', message: error.message || 'Failed to update submission.' });
  }

  if (!data) {
    return res.status(404).json({ error: 'not_found', message: 'Submission not found.' });
  }

  return res.status(200).json({
    data,
    message: 'status_updated'
  });
}
