import { useEffect, useRef } from 'preact/hooks';

export type ServerEvent =
    | {
          type: 'pulse';
          decisionIds: string[];
          source: string;
          client: string | null;
          query?: string;
          timestamp: string;
      }
    | {
          type: 'activity';
          action: string;
          decisionId: string;
          source: string;
          client: string | null;
          timestamp: string;
      }
    | { type: 'data_changed'; timestamp: string };

interface UseLiveEventsOptions {
    onEvent: (event: ServerEvent) => void;
}

/**
 * Subscribes to the UI server's SSE event stream.
 * Handles auto-reconnection via the browser's built-in EventSource retry.
 */
export function useLiveEvents({ onEvent }: UseLiveEventsOptions) {
    const handlerRef = useRef(onEvent);
    handlerRef.current = onEvent;

    useEffect(() => {
        const source = new EventSource('/api/events');

        source.onmessage = (e) => {
            try {
                const event = JSON.parse(e.data) as ServerEvent;
                handlerRef.current(event);
            } catch {
                // Skip malformed event
            }
        };

        source.onerror = () => {
            // EventSource will auto-reconnect — no manual handling needed
        };

        return () => {
            source.close();
        };
    }, []);
}
