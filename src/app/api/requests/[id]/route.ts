import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { withMetrics } from '@/lib/withMetrics';

/**
 * PATCH /api/requests/[id]
 * Body: { status: 'cancelled' | 'fulfilled' }
 *
 * Lets a hospital update the status of its own request — most notably,
 * withdraw ("cancelled") a request once a patient's condition improves
 * or the need is otherwise resolved. Ownership is enforced both here
 * (explicit hospital_id check) and by the requests_update_owner RLS
 * policy on the table itself, so this can't be used to modify someone
 * else's request even if the API check were somehow bypassed.
 */
export const PATCH = withMetrics(
  '/api/requests/[id]',
  async (req: Request, { params }: { params: { id: string } }) => {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { status } = await req.json();
    if (!['cancelled', 'fulfilled'].includes(status)) {
      return NextResponse.json(
        { error: "status must be 'cancelled' or 'fulfilled'" },
        { status: 400 }
      );
    }

    const { data: existing, error: fetchError } = await supabase
      .from('blood_requests')
      .select('hospital_id, status')
      .eq('id', params.id)
      .single();

    if (fetchError || !existing) {
      return NextResponse.json({ error: 'Request not found' }, { status: 404 });
    }

    if (existing.hospital_id !== user.id) {
      return NextResponse.json(
        { error: 'You can only withdraw your own requests' },
        { status: 403 }
      );
    }

    if (['cancelled', 'fulfilled', 'expired'].includes(existing.status)) {
      return NextResponse.json(
        { error: `Request is already ${existing.status}` },
        { status: 409 }
      );
    }

    const { data, error } = await supabase
      .from('blood_requests')
      .update({ status })
      .eq('id', params.id)
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ request: data });
  }
);
