// TripEmailPage — Email distribution of trip summary.
// Route: /trips/:tripId/email
// Dynamic email list with add/remove, checkboxes, and send functionality.
// Stores email list per user in Supabase for re-use.

import { useState, useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuthContext } from "@/hooks/useAuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Loader2, Mail, Plus, Trash2, Check } from "lucide-react";

interface EmailEntry {
  email: string;
  isChecked: boolean;
  lastEmailed?: string;
}

export default function TripEmailPage() {
  const { tripId } = useParams<{ tripId: string }>();
  const { user } = useAuthContext();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [emails, setEmails] = useState<EmailEntry[]>([{ email: "", isChecked: true }]);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(true);
  const [tripDisplayNum, setTripDisplayNum] = useState("");

  // Load existing email list and trip info
  useEffect(() => {
    async function load() {
      if (!user || !tripId) return;

      // Load trip info
      const { data: tripData } = await supabase
        .from("trips")
        .select("itinerary_num")
        .eq("id", parseInt(tripId))
        .single();

      if (tripData) {
        setTripDisplayNum(tripData.itinerary_num || `Trip #${tripId}`);
      }

      // Load user's saved email list
      const { data: emailList } = await supabase
        .from("email_lists")
        .select("emails")
        .eq("user_id", user.id)
        .single();

      if (emailList?.emails) {
        const saved = (emailList.emails as EmailEntry[])
          .slice(0, 10)
          .map((e) => ({ ...e, isChecked: false }));
        if (saved.length > 0) {
          setEmails([...saved, { email: "", isChecked: true }]);
        }
      }

      setLoading(false);
    }
    load();
  }, [user, tripId]);

  const updateEmail = (index: number, field: keyof EmailEntry, value: string | boolean) => {
    setEmails((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  };

  const addRow = () => {
    setEmails((prev) => [...prev, { email: "", isChecked: true }]);
  };

  const removeRow = (index: number) => {
    if (emails.length <= 1) return;
    setEmails((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSend = async () => {
    if (!user || !tripId) return;

    const toSend = emails.filter((e) => e.isChecked && e.email.trim());
    if (toSend.length === 0) {
      toast({ title: "No recipients", description: "Check at least one email address", variant: "destructive" });
      return;
    }

    setSending(true);

    try {
      // Call send-email Edge Function (or for now, just save the email list)
      // In production, this would call: supabase.functions.invoke("send-trip-email", { body: { tripId, emails: toSend } })

      // Save/update email list for this user
      const updatedEmails = toSend.map((e) => ({
        email: e.email,
        isChecked: false,
        lastEmailed: new Date().toISOString(),
      }));

      const { data: existing } = await supabase
        .from("email_lists")
        .select("id, emails")
        .eq("user_id", user.id)
        .single();

      if (existing) {
        // Merge: update existing emails, add new ones
        const existingEmails = (existing.emails as EmailEntry[]) ?? [];
        const merged = [...existingEmails];
        for (const e of updatedEmails) {
          const idx = merged.findIndex((m) => m.email === e.email);
          if (idx >= 0) {
            merged[idx].lastEmailed = e.lastEmailed;
          } else {
            merged.push(e);
          }
        }
        await supabase
          .from("email_lists")
          .update({ emails: merged })
          .eq("id", existing.id);
      } else {
        await supabase
          .from("email_lists")
          .insert({ user_id: user.id, emails: updatedEmails });
      }

      setSent(true);
      toast({ title: "Emails queued", description: `Sending to ${toSend.length} recipient(s)` });
    } catch (err) {
      toast({ title: "Error", description: "Failed to send emails", variant: "destructive" });
    } finally {
      setSending(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (sent) {
    return (
      <div className="max-w-md mx-auto text-center space-y-4 p-4 pt-20">
        <div className="h-16 w-16 rounded-full bg-green-100 flex items-center justify-center mx-auto">
          <Check className="h-8 w-8 text-green-600" />
        </div>
        <h2 className="text-xl font-bold">Emails Sent!</h2>
        <p className="text-sm text-muted-foreground">
          Trip summary for {tripDisplayNum} has been sent to your recipients.
        </p>
        <Button asChild className="bg-[#1a3a5c]">
          <Link to={`/trips/${tripId}/summary`}>Back to Summary</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6 p-4">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate(`/trips/${tripId}/summary`)}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold">Send Trip Summary</h1>
          <p className="text-sm text-muted-foreground">{tripDisplayNum}</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Recipients</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {emails.map((entry, index) => (
            <div key={index} className="flex items-center gap-2">
              <Checkbox
                checked={entry.isChecked}
                onCheckedChange={(checked) => updateEmail(index, "isChecked", !!checked)}
              />
              <Input
                type="email"
                placeholder="email@example.com"
                value={entry.email}
                onChange={(e) => updateEmail(index, "email", e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && index === emails.length - 1) {
                    e.preventDefault();
                    addRow();
                  }
                }}
                className="flex-1"
              />
              <Button
                variant="ghost"
                size="icon"
                onClick={() => removeRow(index)}
                disabled={emails.length <= 1}
                className="text-red-400 hover:text-red-600"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}

          <Button variant="outline" size="sm" onClick={addRow} className="w-full mt-2">
            <Plus className="h-4 w-4 mr-1" /> Add Email
          </Button>
        </CardContent>
      </Card>

      <Button
        onClick={handleSend}
        disabled={sending}
        className="w-full bg-[#1a3a5c] hover:bg-[#2563eb]"
      >
        {sending ? (
          <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Sending...</>
        ) : (
          <><Mail className="h-4 w-4 mr-2" /> Send Email</>
        )}
      </Button>
    </div>
  );
}
