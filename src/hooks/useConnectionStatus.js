import { useRealtimeValue } from '@/hooks/useRealtimeValue';
import { useState, useEffect, useRef } from 'react';

/**
 * Tracks Firebase realtime connection status via `.info/connected`.
 *
 * @returns {{ connected: boolean, showBanner: 'offline' | 'reconnected' | null }}
 *   - connected: current connection state
 *   - showBanner: 'offline' while disconnected, 'reconnected' briefly after
 *     regaining connection, null when idle
 */
/**
 * Debounced connection status — only shows "offline" banner after 3s of
 * continuous disconnection to avoid flickering on brief Wi-Fi jitter.
 */
export function useConnectionStatus() {
  const { value, loading } = useRealtimeValue('.info/connected');
  const [connected, setConnected] = useState(true);
  const [showBanner, setShowBanner] = useState(null);
  const wasDisconnectedRef = useRef(false);
  const reconnectTimerRef = useRef(null);
  const offlineTimerRef = useRef(null);

  useEffect(() => {
    if (loading) return;
    const isConnected = value === true;
    setConnected(isConnected);

    if (!isConnected) {
      // Clear any pending reconnect dismiss timer
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
      wasDisconnectedRef.current = true;
      // Debounce: only show offline banner after 3s of sustained disconnection
      if (!offlineTimerRef.current) {
        offlineTimerRef.current = setTimeout(() => {
          setShowBanner('offline');
          offlineTimerRef.current = null;
        }, 3000);
      }
    } else {
      // Cancel pending offline banner if reconnected quickly
      if (offlineTimerRef.current) {
        clearTimeout(offlineTimerRef.current);
        offlineTimerRef.current = null;
      }
      if (wasDisconnectedRef.current) {
        // Only show "reconnected" if offline banner was actually visible
        wasDisconnectedRef.current = false;
        setShowBanner((prev) => {
          if (prev === 'offline') {
            reconnectTimerRef.current = setTimeout(() => {
              setShowBanner(null);
              reconnectTimerRef.current = null;
            }, 2000);
            return 'reconnected';
          }
          return null;
        });
      }
    }
  }, [value, loading]);

  useEffect(() => () => {
    if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
    if (offlineTimerRef.current) clearTimeout(offlineTimerRef.current);
  }, []);

  return { connected, showBanner };
}
