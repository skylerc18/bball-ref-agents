"use client";

import { useEffect, useRef, useState } from "react";
import { createWsConnection } from "@/lib/ws";
import type { WsServerMessage } from "@/types/api";

export function useWebSocket(enabled: boolean) {
  const socketRef = useRef<WebSocket | null>(null);
  const [messages, setMessages] = useState<WsServerMessage[]>([]);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    if (!enabled) {
      return;
    }

    const socket = createWsConnection((message) => {
      setMessages((prev) => [...prev, message]);
    });

    socketRef.current = socket;

    socket.onopen = () => setIsConnected(true);
    socket.onclose = () => setIsConnected(false);
    socket.onerror = () => setIsConnected(false);

    return () => {
      socket.close();
      socketRef.current = null;
      setIsConnected(false);
    };
  }, [enabled]);

  return {
    isConnected,
    messages,
    socket: socketRef.current,
  };
}
