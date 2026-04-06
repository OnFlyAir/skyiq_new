import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuthContext } from '@/hooks/useAuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Plus, Plane } from 'lucide-react';
import type { Aircraft } from '@/types/database';

export default function FleetPage() {
  const { profile } = useAuthContext();
  const [aircraft, setAircraft] = useState<Aircraft[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (profile?.operator_id) loadAircraft();
  }, [profile]);

  async function loadAircraft() {
    const { data } = await supabase
      .from('aircraft')
      .select('*')
      .eq('operator_id', profile!.operator_id!)
      .order('created_at', { ascending: true });

    if (data) setAircraft(data as Aircraft[]);
    setLoading(false);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-skyiq-accent" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Select an Aircraft</h1>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
        {aircraft.map((ac) => (
          <Link
            key={ac.id}
            to={`/fleet/${ac.id}`}
            className="flex flex-col items-center p-6 bg-white border border-gray-200 rounded-xl hover:border-skyiq-accent hover:shadow-sm transition-all"
          >
            <Plane className="w-16 h-16 text-gray-800 mb-3" />
            <span className="font-medium text-gray-900">{ac.nickname || ac.tail_number}</span>
          </Link>
        ))}

        {/* Add Aircraft */}
        {(profile?.role === 'operator_admin' || profile?.role === 'super_admin') && (
          <Link
            to="/fleet/add"
            className="flex flex-col items-center justify-center p-6 bg-white border-2 border-dashed border-gray-300 rounded-xl hover:border-skyiq-accent hover:bg-gray-50 transition-all"
          >
            <Plus className="w-12 h-12 text-gray-400 mb-3" />
            <span className="font-medium text-gray-600">Add Aircraft</span>
          </Link>
        )}
      </div>
    </div>
  );
}
