import { WS_URL } from "@/lib/constants";
import type { WsServerMessage } from "@/types/api";

export function createWsConnection(
  onMessage: (message: WsServerMessage) => void,
  onError?: (error: Event) => void,
): WebSocket {
  const ws = new WebSocket(WS_URL);

  ws.onmessage = (event) => {
    try {
      const parsed = JSON.parse(event.data as string) as WsServerMessage;
      onMessage(parsed);
    } catch {
      // Ignore malformed messages during early MVP integration.
    }
  };

  if (onError) {
    ws.onerror = onError;
  }

  return ws;
}
