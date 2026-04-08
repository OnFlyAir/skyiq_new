import { useAuthContext } from '@/hooks/useAuthContext';

export default function AdminDashboardPage() {
  const { profile } = useAuthContext();

  if (profile?.role_name !== 'Admin') {
    return <p className="text-muted-foreground">Access denied.</p>;
  }

  return (
    <div className="max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold text-foreground mb-2">Admin Dashboard</h1>
      <p className="text-muted-foreground">Platform admin features coming soon.</p>
    </div>
  );
}
