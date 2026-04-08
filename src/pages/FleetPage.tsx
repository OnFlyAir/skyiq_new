import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuthContext } from '@/hooks/useAuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Plus, Plane } from 'lucide-react';
import type { Aircraft } from '@/types/database';

export default function FleetPage() {
  const { user } = useAuthContext();
  const [aircraft, setAircraft] = useState<Aircraft[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) { loadAircraft(); } else { setLoading(false); }
  }, [user]);

  async function loadAircraft() {
    const { data } = await supabase
      .from('aircrafts')
      .select('*')
      .eq('user_company', user!.id)
      .order('tail_number');

    if (data) setAircraft(data as unknown as Aircraft[]);
    setLoading(false);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold text-foreground mb-6">Select an Aircraft</h1>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
        {aircraft.map((ac) => (
          <Link key={ac.id} to={`/fleet/${ac.id}`} className="flex flex-col items-center p-6 bg-card border border-border rounded-xl hover:border-primary transition-all">
            <Plane className="w-16 h-16 text-muted-foreground mb-3" />
            <span className="font-medium text-foreground">{ac.tail_number}</span>
          </Link>
        ))}

        <Link to="/fleet/add" className="flex flex-col items-center justify-center p-6 border-2 border-dashed border-border rounded-xl hover:border-primary hover:bg-secondary/50 transition-all">
          <Plus className="w-12 h-12 text-muted-foreground mb-3" />
          <span className="font-medium text-muted-foreground">Add Aircraft</span>
        </Link>
      </div>
    </div>
  );
}
