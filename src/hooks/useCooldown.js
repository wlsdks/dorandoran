import { useEffect, useMemo, useSyncExternalStore } from 'react';
import { createCooldown } from '@/lib/cooldown';

export function useCooldown(scope, milliseconds) {
  const controller = useMemo(() => createCooldown(milliseconds, scope), [scope, milliseconds]);
  const canSend = useSyncExternalStore(controller.subscribe, controller.getSnapshot, controller.getSnapshot);
  useEffect(() => { controller.activate(); return () => controller.dispose(); }, [controller]);
  return { ...controller, canSend };
}
