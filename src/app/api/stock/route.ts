import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { withMetrics } from '@/lib/withMetrics';

// GET /api/stock — list all blood banks with current stock
export const GET = withMetrics('/api/stock', async () => {
  const supabase = createClient();
  const { data, error } = await supabase.from('blood_banks').select('*').order('name');
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ blood_banks: data });
});

// POST /api/stock — bulk upload blood banks (from CSV parsed client-side into JSON)
// Expected body: { banks: [{ name, latitude, longitude, address, contact_number, stock }] }
export const POST = withMetrics('/api/stock', async (req: Request) => {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (!profile || !['hospital', 'admin'].includes(profile.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { banks } = await req.json();
  if (!Array.isArray(banks) || banks.length === 0) {
    return NextResponse.json({ error: 'banks array is required' }, { status: 400 });
  }

  const rows = banks.map((b) => ({ ...b, managed_by: user.id }));
  const { data, error } = await supabase.from('blood_banks').insert(rows).select();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ inserted: data.length, blood_banks: data }, { status: 201 });
});