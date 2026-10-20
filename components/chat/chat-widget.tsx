'use client';

import { useEffect, useId, useState } from 'react';
import { MessageCircle, X } from 'lucide-react';

/** Floating chat affordance (README §5). Opens a placeholder panel until an
 * Admin-configured AI service is wired; the badge itself stays interactive. */
export function ChatWidget() {
  const [open, setOpen] = useState(false);
  const panelId = useId();

  useEffect(() => {
    if (!open) return;

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false);
    }

    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open]);

  return (
    <div className={open ? 'chat-widget is-open' : 'chat-widget'}>
      {open && (
        <div
          id={panelId}
          className="blueprint elev-md chat-panel"
          role="dialog"
          aria-label="Chat"
        >
          <div className="chat-panel-header">
            <div className="chat-panel-title">Chat</div>
            <button
              type="button"
              className="btn btn-ghost btn-icon"
              aria-label="Close chat"
              onClick={() => setOpen(false)}
            >
              <X size={18} strokeWidth={1.5} aria-hidden />
            </button>
          </div>
          <div className="chat-panel-body">
            <p>
              AI chat is not connected yet. An admin will configure the service
              under Database Manager when it is available.
            </p>
            <p className="text-muted" style={{ marginBottom: 0 }}>
              Coming in a later phase.
            </p>
          </div>
          <div className="chat-panel-composer">
            <input
              type="text"
              className="input"
              placeholder="Message…"
              disabled
              title="Coming in a later phase"
              aria-label="Chat message"
            />
            <button type="button" className="btn btn-primary" disabled title="Coming in a later phase">
              Send
            </button>
          </div>
        </div>
      )}
      <button
        type="button"
        className="blueprint elev-md chat-fab"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        aria-label={open ? 'Close chat' : 'Open chat'}
        title={open ? 'Close chat' : 'Chat'}
        onClick={() => setOpen(current => !current)}
      >
        {open ? (
          <X size={22} strokeWidth={1.5} aria-hidden />
        ) : (
          <MessageCircle size={22} strokeWidth={1.5} aria-hidden />
        )}
      </button>
    </div>
  );
}
