import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { getStripeEnvironment } from '@/lib/stripe';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { Loader2, Sparkles, ShieldCheck } from 'lucide-react';

type Step = 'reason' | 'offer' | 'verify';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  accountEmail?: string | null;
  alreadyDiscounted?: boolean;
  onDone: () => void;
}

export default function CancelSubscriptionDialog({
  open, onOpenChange, accountEmail, alreadyDiscounted, onDone,
}: Props) {
  const { toast } = useToast();
  const [step, setStep] = useState<Step>('reason');
  const [reason, setReason] = useState('');
  const [requestId, setRequestId] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);

  function reset() {
    setStep('reason'); setReason(''); setRequestId(null); setCode(''); setBusy(false);
  }

  async function call(action: string, extra: Record<string, unknown> = {}) {
    const { data, error } = await supabase.functions.invoke('cancel-subscription', {
      body: { action, environment: getStripeEnvironment(), request_id: requestId, ...extra },
    });
    if (error) {
      const msg = (data as any)?.error || error.message || 'Something went wrong';
      throw new Error(msg);
    }
    if ((data as any)?.error) throw new Error((data as any).error);
    return data as any;
  }

  async function handleStart() {
    setBusy(true);
    try {
      const data = await call('start', { reason });
      setRequestId(data.request_id);
      setStep('offer');
    } catch (e) {
      toast({ title: 'Error', description: e instanceof Error ? e.message : 'Failed', variant: 'destructive' });
    } finally { setBusy(false); }
  }

  async function handleAcceptOffer() {
    setBusy(true);
    try {
      await call('accept_offer');
      toast({ title: 'Discount applied', description: 'Your plan stays active with 20% off going forward.' });
      onOpenChange(false); reset(); onDone();
    } catch (e) {
      toast({ title: 'Error', description: e instanceof Error ? e.message : 'Failed', variant: 'destructive' });
    } finally { setBusy(false); }
  }

  async function handleSendCode() {
    setBusy(true);
    try {
      await call('send_code');
      setStep('verify');
      toast({ title: 'Code sent', description: `We emailed a 6-digit code to ${accountEmail ?? 'your account email'}.` });
    } catch (e) {
      toast({ title: 'Error', description: e instanceof Error ? e.message : 'Failed', variant: 'destructive' });
    } finally { setBusy(false); }
  }

  async function handleConfirm() {
    setBusy(true);
    try {
      const data = await call('confirm', { code });
      toast({
        title: 'Subscription canceled',
        description: data.access_until
          ? `You keep access until ${new Date(data.access_until).toLocaleDateString()}.`
          : 'Your plan has been canceled.',
      });
      onOpenChange(false); reset(); onDone();
    } catch (e) {
      toast({ title: 'Error', description: e instanceof Error ? e.message : 'Failed', variant: 'destructive' });
    } finally { setBusy(false); }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { onOpenChange(o); if (!o) reset(); }}>
      <DialogContent className="sm:max-w-md">
        {step === 'reason' && (
          <>
            <DialogHeader>
              <DialogTitle>Cancel your subscription</DialogTitle>
              <DialogDescription>
                You'll keep access until the end of your current billing period.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">What made you decide to leave? (optional)</label>
              <Textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={3} placeholder="Too expensive, missing a feature, not flying as much…" />
            </div>
            <DialogFooter className="gap-2 sm:gap-2">
              <Button variant="ghost" onClick={() => onOpenChange(false)}>Keep my plan</Button>
              <Button variant="destructive" onClick={handleStart} disabled={busy}>
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Continue'}
              </Button>
            </DialogFooter>
          </>
        )}

        {step === 'offer' && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-primary" /> Before you go — 20% off
              </DialogTitle>
              <DialogDescription>
                {alreadyDiscounted
                  ? 'You already have a loyalty discount on this plan.'
                  : 'Stay with SkyIQ and we\'ll take 20% off every future invoice, starting with your next one.'}
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="gap-2 sm:gap-2">
              <Button variant="ghost" onClick={handleSendCode} disabled={busy}>
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : 'No thanks, cancel'}
              </Button>
              {!alreadyDiscounted && (
                <Button onClick={handleAcceptOffer} disabled={busy}>Keep 20% off</Button>
              )}
            </DialogFooter>
          </>
        )}

        {step === 'verify' && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <ShieldCheck className="h-5 w-5 text-primary" /> Confirm it's you
              </DialogTitle>
              <DialogDescription>
                Enter the 6-digit code we emailed to {accountEmail ?? 'your account email'}. It expires in 10 minutes.
              </DialogDescription>
            </DialogHeader>
            <Input
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              inputMode="numeric"
              placeholder="123456"
              className="text-center text-2xl tracking-[0.5em] font-semibold"
            />
            <DialogFooter className="gap-2 sm:gap-2">
              <Button variant="ghost" onClick={handleSendCode} disabled={busy}>Resend code</Button>
              <Button variant="destructive" onClick={handleConfirm} disabled={busy || code.length !== 6}>
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Cancel subscription'}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
