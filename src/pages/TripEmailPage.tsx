import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Plus, Trash2, Send } from 'lucide-react';

interface EmailRow {
  email: string;
  selected: boolean;
}

export default function TripEmailPage() {
  const { tripId } = useParams<{ tripId: string }>();
  const navigate = useNavigate();
  const [rows, setRows] = useState<EmailRow[]>([
    { email: '', selected: true },
  ]);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  function addRow() {
    setRows((prev) => [...prev, { email: '', selected: true }]);
  }

  function removeRow() {
    if (rows.length > 1) {
      setRows((prev) => prev.slice(0, -1));
    }
  }

  function updateRow(index: number, field: keyof EmailRow, value: any) {
    setRows((prev) =>
      prev.map((r, i) => (i === index ? { ...r, [field]: value } : r))
    );
  }

  async function handleSend() {
    const selected = rows.filter((r) => r.selected && r.email);
    if (selected.length === 0) return;

    setSending(true);
    // TODO: Call Resend edge function to send trip summary emails
    // For now, just simulate
    await new Promise((r) => setTimeout(r, 1000));
    setSending(false);
    setSent(true);
  }

  if (sent) {
    return (
      <div className="max-w-lg mx-auto text-center py-12">
        <h2 className="text-xl font-bold text-gray-900 mb-2">Email sent!</h2>
        <p className="text-gray-500 mb-6">Trip summary has been emailed to the selected recipients.</p>
        <button
          onClick={() => navigate(`/trips/${tripId}/summary`)}
          className="px-6 py-3 bg-skyiq-accent text-white rounded-lg"
        >
          Back to Trip Summary
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 mb-1">Trip Summary</h1>
      <p className="text-sm text-gray-500 mb-6">Quick Ref Fuel Plan</p>

      <table className="w-full border border-gray-300 mb-6">
        <thead>
          <tr className="bg-gray-50">
            <th className="px-4 py-3 text-left text-sm font-semibold border-b">Send Plan</th>
            <th className="px-4 py-3 text-left text-sm font-semibold border-b">Email Address</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="border-b">
              <td className="px-4 py-3 text-center">
                <input
                  type="checkbox"
                  checked={row.selected}
                  onChange={(e) => updateRow(i, 'selected', e.target.checked)}
                  className="rounded border-gray-300"
                />
              </td>
              <td className="px-4 py-3">
                <input
                  type="email"
                  value={row.email}
                  onChange={(e) => updateRow(i, 'email', e.target.value)}
                  placeholder="email@example.com"
                  className="w-full px-3 py-2 bg-gray-100 rounded-lg text-sm"
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="flex gap-3">
        <button
          onClick={handleSend}
          disabled={sending}
          className="flex items-center gap-2 px-4 py-2 bg-gray-900 text-white rounded-lg text-sm hover:bg-gray-800 disabled:opacity-50"
        >
          <Send className="w-4 h-4" />
          {sending ? 'Sending...' : 'Send Email'}
        </button>
        <button
          onClick={addRow}
          className="flex items-center gap-2 px-4 py-2 bg-gray-900 text-white rounded-lg text-sm hover:bg-gray-800"
        >
          <Plus className="w-4 h-4" />
          Add Email
        </button>
        <button
          onClick={removeRow}
          className="flex items-center gap-2 px-4 py-2 bg-gray-900 text-white rounded-lg text-sm hover:bg-gray-800"
        >
          <Trash2 className="w-4 h-4" />
          Remove Email
        </button>
      </div>
    </div>
  );
}
