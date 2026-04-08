import { useEffect, useState } from 'react';
import { useAuthContext } from '@/hooks/useAuthContext';
import { supabase } from '@/integrations/supabase/client';

export default function SavingsPage() {
  const { user } = useAuthContext();
  const [totalSavings, setTotalSavings] = useState(0);
  const [totalTrips, setTotalTrips] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) { loadSavings(); } else { setLoading(false); }
  }, [user]);

  async function loadSavings() {
    const { data: trips } = await supabase
      .from('trips')
      .select('savings')
      .eq('user_company', user!.id);

    if (trips) {
      const total = trips.reduce((sum: number, t: any) => sum + Number(t.savings || 0), 0);
      setTotalSavings(total);
      setTotalTrips(trips.length);
    }
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
    <div className="max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold text-foreground mb-2">Potential Savings Earned</h1>
      <p className="text-sm text-muted-foreground italic mb-8">
        We show half the difference between your optimized fuel plan and a typical worst-case — giving you a realistic view of your likely savings.
      </p>

      <div className="flex gap-8 mb-8">
        <div className="p-4 bg-card border border-border rounded-xl flex-1">
          <p className="text-sm text-muted-foreground">Total Savings</p>
          <p className="text-2xl font-bold text-primary">${totalSavings.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
        </div>
        <div className="p-4 bg-card border border-border rounded-xl flex-1">
          <p className="text-sm text-muted-foreground">Fuel Plans Calculated</p>
          <p className="text-2xl font-bold text-foreground">{totalTrips}</p>
        </div>
      </div>

      {totalTrips === 0 && (
        <p className="text-center text-muted-foreground py-12">No trips calculated yet. Plan a trip to see your savings!</p>
      )}
    </div>
  );
}
