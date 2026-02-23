/**
 * Native Push Notifications helper
 * Registers device for push notifications using @capacitor/push-notifications
 * and saves FCM token to the database
 */

import { isNativePlatform } from './nativeTracking';
import { supabase } from '@/integrations/supabase/client';
import { getTenantId } from '@/hooks/useTenantId';

let initialized = false;
let attemptedInit = false;

export async function initPushNotifications(driverId: string | null) {
  if (!isNativePlatform() || initialized || attemptedInit || !driverId) return;
  attemptedInit = true;

  // Defer to let the app fully render first and avoid crash-on-launch loops
  setTimeout(async () => {
    try {
      const { PushNotifications } = await import('@capacitor/push-notifications');

      // Request permission first
      const permResult = await PushNotifications.requestPermissions();
      if (permResult.receive !== 'granted') {
        console.log('[Push] Permission denied');
        return;
      }

      // Add listeners BEFORE calling register to catch all events
      PushNotifications.addListener('registration', async (token) => {
        console.log('[Push] Token:', token.value);
        const tenant_id = await getTenantId();
        await supabase.from('push_tokens').upsert(
          {
            driver_id: driverId,
            token: token.value,
            platform: 'android',
            tenant_id,
          } as any,
          { onConflict: 'driver_id,token' }
        );
      });

      PushNotifications.addListener('registrationError', (err) => {
        console.error('[Push] Registration error:', err);
      });

      PushNotifications.addListener('pushNotificationReceived', (notification) => {
        console.log('[Push] Received in foreground:', notification);
      });

      PushNotifications.addListener('pushNotificationActionPerformed', (action) => {
        console.log('[Push] Action performed:', action);
        const data = action.notification.data;
        if (data?.load_id) {
          window.location.href = `/driver/loads/${data.load_id}`;
        }
      });

      // Register — this is what can crash if FCM/google-services.json is missing
      await PushNotifications.register();
      initialized = true;
    } catch (err) {
      console.error('[Push] Init error:', err);
      // Don't set initialized=true so we know it failed,
      // but attemptedInit prevents infinite retry loops
    }
  }, 2000);
}
