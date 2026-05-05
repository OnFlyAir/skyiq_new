// PostHog client — initialized once at app boot. Project API key is publishable
// (safe in client code). Pageviews are captured manually on route change.
import posthog from 'posthog-js';

const POSTHOG_KEY = 'phc_Ca872PnPiV9LfqQ7ac6JKbX2VeFWoYykrwcLtJLQmbLe';
const POSTHOG_HOST = 'https://us.i.posthog.com';

let initialized = false;

export function initPostHog() {
  if (initialized || typeof window === 'undefined') return;
  initialized = true;
  posthog.init(POSTHOG_KEY, {
    api_host: POSTHOG_HOST,
    capture_pageview: false, // we handle this manually with React Router
    capture_pageleave: true,
    person_profiles: 'identified_only',
  });
}

export { posthog };
