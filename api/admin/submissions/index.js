import { requireAdmin } from '../../_lib/requireAdmin.js';

const ALLOWED_STATUSES = new Set(['all', 'pending', 'approved', 'rejected']);
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

function parseIntParam(value, fallback) {
  if (value === undefined || value === null || value === '') {
    return fallback;
  }
  const parsed = Number.parseInt(String(value), 10);
  return Number.isNaN(parsed) ? null : parsed;
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'method_not_allowed', message: 'Method not allowed.' });
  }

  const auth = await requireAdmin(req, res);
  if (!auth) {
    return;
  }
  const { supabase } = auth;

  const status = String(req.query?.status || 'all').toLowerCase();
  if (!ALLOWED_STATUSES.has(status)) {
    return res.status(400).json({
      error: 'invalid_query',
      message: "status must be one of: all, pending, approved, rejected."
    });
  }

  const limit = parseIntParam(req.query?.limit, 50);
  if (limit === null || limit <= 0 || limit > 200) {
    return res
      .status(400)
      .json({ error: 'invalid_query', message: 'limit must be an integer between 1 and 200.' });
  }

  const offset = parseIntParam(req.query?.offset, 0);
  if (offset === null || offset < 0) {
    return res
      .status(400)
      .json({ error: 'invalid_query', message: 'offset must be an integer greater than or equal to 0.' });
  }

  let countQuery = supabase
    .from('memories')
    .select('id', { count: 'exact', head: true });

  let dataQuery = supabase
    .from('memories')
    .select(SELECT_COLUMNS)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (status !== 'all') {
    countQuery = countQuery.eq('status', status);
    dataQuery = dataQuery.eq('status', status);
  }

  const [{ count, error: countError }, { data, error: dataError }] = await Promise.all([
    countQuery,
    dataQuery
  ]);

  if (countError || dataError) {
    return res.status(500).json({
      error: 'db_error',
      message: countError?.message || dataError?.message || 'Failed to fetch submissions.'
    });
  }

  return res.status(200).json({
    data: data || [],
    pagination: {
      limit,
      offset,
      count: typeof count === 'number' ? count : (data || []).length
    },
    filter: {
      status
    }
  });
}
