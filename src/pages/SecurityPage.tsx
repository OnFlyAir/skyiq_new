import { Link } from 'react-router-dom';
import { useEffect } from 'react';
import skyiqLogo from '@/assets/skyiq-logo-circle.png';
import { Shield, Lock, Database, Brain, UserCheck, Download, Cloud, FileSignature, Bug } from 'lucide-react';

interface Section {
  id: string;
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  body: React.ReactNode;
}

const SECTIONS: Section[] = [
  {
    id: 'encryption',
    icon: Lock,
    title: 'Encrypted in transit and at rest',
    body: (
      <>
        Every request to SkyIQ is served over HTTPS (TLS 1.2 or higher), terminated at our cloud
        provider's edge. Trip PDFs, parsed itineraries, and every database row are stored
        encrypted at rest with AES-256 keys managed by the underlying cloud platform.
        Backups inherit the same encryption.
      </>
    ),
  },
  {
    id: 'isolation',
    icon: Database,
    title: 'Per-operator data isolation',
    body: (
      <>
        Every table that holds your data — trips, aircraft, parsed itineraries, client contacts,
        email lists — is protected by row-level security policies enforced by the database
        itself. Each row is stamped with the owning user's ID, and the database refuses to
        return rows that don't match the requesting user's authenticated session. This means
        even if a bug somehow let application code ask for another operator's data, the database
        would still return nothing. Isolation is enforced at the lowest possible layer, not in
        application code that could regress.
      </>
    ),
  },
  {
    id: 'ai',
    icon: Brain,
    title: 'We never train AI on your data, sell it, or share it',
    body: (
      <>
        Itineraries are sent to our AI parsing provider only for the few seconds needed to
        extract structured fields (tail number, legs, fuel quotes, passenger weights). Training
        and long-term retention are disabled by contract — your PDFs are not used to improve
        anyone's models. We do not sell, rent, or share operator data with third parties for
        marketing, analytics, or market intelligence. Ever.
      </>
    ),
  },
  {
    id: 'access',
    icon: UserCheck,
    title: 'Strict, audited internal access',
    body: (
      <>
        Production data access is limited to engineers who need it to provide support. Access
        is role-based and protected by MFA on every underlying cloud account. Every privileged
        action — disabling a user, deleting an aircraft, issuing a billing change — is written
        to an immutable audit log inside the database itself, with the actor's identity, the
        target, and a timestamp.
      </>
    ),
  },
  {
    id: 'ownership',
    icon: Download,
    title: 'You own your data',
    body: (
      <>
        Your trips, aircraft, parsed itineraries, and client contacts belong to you. On
        request we will export everything we hold for your account in a machine-readable format,
        or permanently delete your account and all associated data — including stored PDFs,
        email lists, and analytics — within 30 days. Contact{' '}
        <a className="text-primary hover:underline" href="mailto:info@skyiq.net">
          info@skyiq.net
        </a>{' '}
        to start either request.
      </>
    ),
  },
  {
    id: 'hosting',
    icon: Cloud,
    title: 'Hosted on hardened cloud infrastructure',
    body: (
      <>
        SkyIQ runs on a managed cloud platform (Supabase on AWS, US region). That platform
        holds SOC 2 Type 2 and ISO 27001 certifications, and we inherit its physical security,
        network controls, automated backups, and disaster-recovery posture. Payments are
        processed by Stripe (PCI DSS Level 1) — we never see or store credit-card numbers.
      </>
    ),
  },
  {
    id: 'legal',
    icon: FileSignature,
    title: 'NDA and DPA on request',
    body: (
      <>
        Happy to sign your NDA or Data Processing Agreement before any pilot, passenger, or
        client data is uploaded. Email{' '}
        <a className="text-primary hover:underline" href="mailto:info@skyiq.net">
          info@skyiq.net
        </a>{' '}
        with your draft and we'll turn it around quickly.
      </>
    ),
  },
  {
    id: 'disclosure',
    icon: Bug,
    title: 'Reporting a vulnerability',
    body: (
      <>
        If you believe you've found a security issue, please email{' '}
        <a className="text-primary hover:underline" href="mailto:info@skyiq.net">
          info@skyiq.net
        </a>{' '}
        with details and reproduction steps. We follow responsible-disclosure practices, will
        acknowledge your report within two business days, and will not pursue legal action
        against good-faith researchers.
      </>
    ),
  },
];

export default function SecurityPage() {
  useEffect(() => {
    document.title = 'Security & Data Protection — SkyIQ';
    const setMeta = (name: string, content: string) => {
      let el = document.querySelector(`meta[name="${name}"]`) as HTMLMetaElement | null;
      if (!el) {
        el = document.createElement('meta');
        el.setAttribute('name', name);
        document.head.appendChild(el);
      }
      el.content = content;
    };
    setMeta(
      'description',
      'How SkyIQ protects your trip itineraries and client data: encryption, per-operator isolation, no AI training, audited access, and SOC 2 hosting.',
    );
  }, []);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card/50 backdrop-blur sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-3">
            <img src={skyiqLogo} alt="SkyIQ" className="w-9 h-9 object-contain" />
            <span className="font-semibold text-lg">SkyIQ</span>
          </Link>
          <nav className="text-sm">
            <Link to="/login" className="text-primary hover:underline font-medium">
              Sign in
            </Link>
          </nav>
        </div>
      </header>

      {/* Hero */}
      <section className="max-w-5xl mx-auto px-6 pt-12 pb-8">
        <div className="flex items-center gap-3 text-primary mb-4">
          <Shield className="w-6 h-6" />
          <span className="text-sm font-semibold uppercase tracking-wider">
            Security &amp; Data Protection
          </span>
        </div>
        <h1 className="text-4xl sm:text-5xl font-bold tracking-tight mb-4">
          Your trip data, treated like the sensitive cargo it is.
        </h1>
        <p className="text-lg text-muted-foreground max-w-3xl">
          Operators upload trip itineraries with passenger names, contact details, tail
          numbers, and confidential FBO fuel quotes. Here is exactly how SkyIQ protects it —
          not just what we promise, but how it's enforced.
        </p>
      </section>

      {/* Sections */}
      <section className="max-w-5xl mx-auto px-6 pb-16 grid gap-4 sm:grid-cols-2">
        {SECTIONS.map(({ id, icon: Icon, title, body }) => (
          <article
            key={id}
            id={id}
            className="bg-card border border-border rounded-xl p-6 scroll-mt-24"
          >
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                <Icon className="w-5 h-5" />
              </div>
              <h2 className="font-semibold text-lg">{title}</h2>
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed">{body}</p>
          </article>
        ))}
      </section>

      {/* CTA */}
      <section className="max-w-5xl mx-auto px-6 pb-20">
        <div className="bg-primary/5 border border-primary/20 rounded-xl p-8 text-center">
          <h3 className="text-2xl font-bold mb-2">Need a security review before piloting?</h3>
          <p className="text-muted-foreground mb-5">
            We're happy to walk your IT or legal team through our controls, sign your NDA or
            DPA, and answer any questionnaires.
          </p>
          <a
            href="mailto:info@skyiq.net?subject=Security%20review"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-primary text-primary-foreground font-semibold hover:bg-primary/90 transition-colors"
          >
            Contact info@skyiq.net
          </a>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border py-8 text-center text-sm text-muted-foreground">
        <p>
          © {new Date().getFullYear()} SkyIQ ·{' '}
          <Link to="/login" className="hover:underline">
            Sign in
          </Link>
        </p>
      </footer>
    </div>
  );
}
