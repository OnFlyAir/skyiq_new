// Tracks pageviews on route change and identifies/resets the PostHog user
// based on the auth session. Mounted once inside <BrowserRouter>.
import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { posthog } from '@/lib/posthog';
import { useAuthContext } from '@/hooks/useAuthContext';

export default function PostHogTracker() {
  const location = useLocation();
  const { user } = useAuthContext();

  // Pageview on every route change
  useEffect(() => {
    posthog.capture('$pageview', {
      $current_url: window.location.href,
      path: location.pathname,
    });
  }, [location.pathname]);

  // Identify or reset user based on auth state
  useEffect(() => {
    if (user?.id) {
      posthog.identify(user.id, {
        email: user.email,
      });
    } else {
      // Logged out — clear distinct_id so the next user is tracked separately
      posthog.reset();
    }
  }, [user?.id, user?.email]);

  return null;
}
