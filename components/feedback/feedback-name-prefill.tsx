'use client';

import { useEffect } from 'react';

/** The slice of the widget's browser API this application uses. Declared here
 * rather than as a `Window` augmentation, which would require an `interface`. */
type ClientFeedback = {
  ready: () => Promise<void>;
  prefill: (fields: { name?: string | null }) => void;
};

function clientFeedback(): ClientFeedback | undefined {
  return (window as unknown as { ClientFeedback?: ClientFeedback }).ClientFeedback;
}

/** Pre-fills the feedback widget's "Name" field for the signed-in user.
 *
 * The widget owns the behaviour from here: it applies the prefill when the
 * dialog opens and again after a successful send, and leaves a name the
 * visitor has edited alone. A null name clears a value an earlier render set,
 * so this stays rendered even when the user has no name to offer. Renders
 * nothing; it exists for the effect. */
export function FeedbackNamePrefill({ name }: { name: string | null }) {
  useEffect(() => {
    let cancelled = false;
    let timer = 0;
    const deadline = Date.now() + 15_000;

    const attempt = () => {
      if (cancelled) return;

      const api = clientFeedback();
      if (!api) {
        // The loader is injected after hydration, so it is routinely slower
        // than this effect. Wait for it rather than racing it.
        if (Date.now() < deadline) timer = window.setTimeout(attempt, 200);
        return;
      }

      api.ready()
        .then(() => {
          if (!cancelled) api.prefill({ name });
        })
        // There is no widget to fill: config is refused for any origin the
        // vendor has not registered, and `ready()` never resolves there.
        .catch(() => {});
    };

    attempt();

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [name]);

  return null;
}
