import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Plus, Trash2, Send, CheckCircle } from 'lucide-react';

interface EmailRow {
  email: string;
  selected: boolean;
}

export default function TripEmailPage() {
  const { tripId } = useParams<{ tripId: string }>();
  const navigate = useNavigate();
  const [rows, setRows] = useState<EmailRow[]>([{ email: '', selected: true }]);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  function addRow() { setRows((prev) => [...prev, { email: '', selected: true }]); }
  function removeRow() { if (rows.length > 1) setRows((prev) => prev.slice(0, -1)); }
  function updateRow(index: number, field: keyof EmailRow, value: any) {
    setRows((prev) => prev.map((r, i) => (i === index ? { ...r, [field]: value } : r)));
  }

  async function handleSend() {
    const selected = rows.filter((r) => r.selected && r.email);
    if (selected.length === 0) return;
    setSending(true);
    await new Promise((r) => setTimeout(r, 1000));
    setSending(false);
    setSent(true);
  }

  if (sent) {
    return (
      <div className="max-w-lg mx-auto text-center py-12">
        <div className="w-14 h-14 bg-skyiq-success/20 rounded-full flex items-center justify-center mx-auto mb-4">
          <CheckCircle className="h-7 w-7 text-skyiq-success" />
        </div>
        <h2 className="text-xl font-bold text-foreground mb-2">Email sent!</h2>
        <p className="text-muted-foreground mb-6">Trip summary has been emailed to the selected recipients.</p>
        <button
          onClick={() => navigate(`/trips/${tripId}/summary`)}
          className="px-6 py-3 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-all"
        >
          Back to Trip Summary
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold text-foreground mb-1">Trip Summary</h1>
      <p className="text-sm text-muted-foreground mb-6">Quick Ref Fuel Plan</p>

      <div className="border border-border rounded-lg overflow-hidden mb-6">
        <div className="grid grid-cols-[auto_1fr] bg-secondary">
          <div className="px-4 py-3 text-sm font-semibold text-foreground border-b border-border">Send Plan</div>
          <div className="px-4 py-3 text-sm font-semibold text-foreground border-b border-border">Email Address</div>
        </div>
        {rows.map((row, i) => (
          <div key={i} className="grid grid-cols-[auto_1fr] border-b border-border last:border-b-0">
            <div className="px-4 py-3 flex items-center justify-center">
              <input
                type="checkbox"
                checked={row.selected}
                onChange={(e) => updateRow(i, 'selected', e.target.checked)}
                className="rounded border-border bg-secondary/50 text-primary focus:ring-primary/40"
              />
            </div>
            <div className="px-4 py-3">
              <input
                type="email"
                value={row.email}
                onChange={(e) => updateRow(i, 'email', e.target.value)}
                placeholder="email@example.com"
                className="w-full px-3 py-2 bg-secondary/50 border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-all"
              />
            </div>
          </div>
        ))}
      </div>

      <div className="flex gap-3">
        <button onClick={handleSend} disabled={sending} className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm hover:bg-primary/90 disabled:opacity-50 transition-all">
          <Send className="w-4 h-4" />
          {sending ? 'Sending...' : 'Send Email'}
        </button>
        <button onClick={addRow} className="flex items-center gap-2 px-4 py-2 bg-secondary text-secondary-foreground rounded-lg text-sm hover:bg-secondary/80 transition-colors">
          <Plus className="w-4 h-4" />
          Add Email
        </button>
        <button onClick={removeRow} className="flex items-center gap-2 px-4 py-2 bg-secondary text-secondary-foreground rounded-lg text-sm hover:bg-secondary/80 transition-colors">
          <Trash2 className="w-4 h-4" />
          Remove Email
        </button>
      </div>
    </div>
  );
}
