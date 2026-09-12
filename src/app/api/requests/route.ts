import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { bloodRequestsCounter } from '@/lib/metrics';

// GET /api/requests — list active blood requests (optionally filter by blood_group)
export async function GET(req: Request) {
  const supabase = createClient();
  const { searchParams } = new URL(req.url);
  const bloodGroup = searchParams.get('blood_group');

  let query = supabase
    .from('blood_requests')
    .select('*')
    .in('status', ['open', 'partially_fulfilled'])
    .order('created_at', { ascending: false });

  if (bloodGroup) {
    query = query.eq('blood_group', bloodGroup);
  }

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ requests: data });
}

// POST /api/requests — hospital/admin creates a new urgent blood request
export async function POST(req: Request) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (!profile || !['hospital', 'admin'].includes(profile.role)) {
    return NextResponse.json(
      { error: 'Only hospitals or admins can post blood requests' },
      { status: 403 }
    );
  }

  const body = await req.json();
  const { blood_group, units_needed, urgency, patient_condition, latitude, longitude, address } =
    body;

  if (!blood_group || !units_needed || !latitude || !longitude) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }

  const { data, error } = await supabase
    .from('blood_requests')
    .insert({
      hospital_id: user.id,
      blood_group,
      units_needed,
      urgency: urgency ?? 'medium',
      patient_condition,
      latitude,
      longitude,
      address,
      status: 'open',
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  bloodRequestsCounter.inc({ urgency: data.urgency, blood_group: data.blood_group });

  return NextResponse.json({ request: data }, { status: 201 });
}
