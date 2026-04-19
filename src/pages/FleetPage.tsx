import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuthContext } from '@/hooks/useAuthContext';
import { useDemo } from '@/contexts/DemoContext';
import { supabase } from '@/integrations/supabase/client';
import { Plus, Plane, Play } from 'lucide-react';
import type { Aircraft } from '@/types/database';
import { Button } from '@/components/ui/button';

export default function FleetPage() {
  const { user } = useAuthContext();
  const { active: demoActive, startDemo } = useDemo();
  const [aircraft, setAircraft] = useState<Aircraft[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      loadAircraft();
    } else {
      setLoading(false);
    }
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

  if (aircraft.length === 0) {
    return (
      <div className="max-w-2xl mx-auto">
        <div className="rounded-2xl border border-border bg-card p-8 text-center space-y-5">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <Plane className="h-7 w-7" />
          </div>
          <div className="space-y-1">
            <h1 className="text-2xl font-bold text-foreground">Add your first aircraft</h1>
            <p className="text-sm text-muted-foreground">You only do this once.</p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
            <Button asChild className="sm:min-w-40" data-demo="add-aircraft-btn">
              <Link to="/fleet/add">Add Aircraft</Link>
            </Button>
            <Button asChild variant="outline" className="sm:min-w-40">
              <Link to="/trips/new">Upload PDF</Link>
            </Button>
          </div>
          {!demoActive && (
            <button
              onClick={() => startDemo('fleet')}
              className="text-xs text-primary hover:underline inline-flex items-center gap-1"
            >
              <Play className="h-3 w-3" /> Watch the guided demo instead
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground">Fleet</h1>
        {!demoActive && (
          <Button variant="outline" size="sm" onClick={() => startDemo('fleet')}>
            <Play className="h-4 w-4 mr-1.5" /> Demo
          </Button>
        )}
      </div>
      <div className="grid grid-cols-2 gap-6 md:grid-cols-3 lg:grid-cols-4">
        {aircraft.map((ac) => (
          <Link
            key={ac.id}
            to={`/fleet/${ac.id}`}
            className="flex flex-col items-center rounded-xl border border-border bg-card p-6 transition-all hover:border-primary hover:bg-secondary/30"
          >
            <Plane className="mb-3 h-16 w-16 text-muted-foreground" />
            <span className="font-medium text-foreground">{ac.tail_number}</span>
          </Link>
        ))}

        <Link
          to="/fleet/add"
          data-demo="add-aircraft-btn"
          className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-border p-6 transition-all hover:border-primary hover:bg-secondary/30"
        >
          <Plus className="mb-3 h-12 w-12 text-muted-foreground" />
          <span className="font-medium text-muted-foreground">Add Aircraft</span>
        </Link>
      </div>
    </div>
  );
}
