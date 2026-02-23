/**
 * Native Push Notifications helper
 * Registers device for push notifications using @capacitor/push-notifications
 * and saves FCM token to the database
 * 
 * IMPORTANT: Push notification registration is currently DISABLED to prevent
 * native crashes on Android when Firebase/FCM is not properly configured.
 * To re-enable, set PUSH_ENABLED = true below after verifying google-services.json
 * is correctly set up in the Android project.
 */

import { isNativePlatform } from './nativeTracking';
import { supabase } from '@/integrations/supabase/client';
import { getTenantId } from '@/hooks/useTenantId';

// ⚠️ Set to true ONLY after Firebase is properly configured in the native project
const PUSH_ENABLED = false;

let initialized = false;
let attemptedInit = false;

export async function initPushNotifications(driverId: string | null) {
  if (!PUSH_ENABLED) {
    console.log('[Push] Push notifications are disabled (PUSH_ENABLED=false)');
    return;
  }

  if (!isNativePlatform() || initialized || attemptedInit || !driverId) return;
  attemptedInit = true;

  // Defer to 8s to let the app fully render and stabilize first
  setTimeout(async () => {
    try {
      const { PushNotifications } = await import('@capacitor/push-notifications');

      if (!PushNotifications) {
        console.warn('[Push] PushNotifications plugin not available');
        return;
      }

      // Check permission status first (non-destructive call)
      let permStatus;
      try {
        permStatus = await PushNotifications.checkPermissions();
      } catch (checkErr) {
        console.warn('[Push] checkPermissions failed, aborting:', checkErr);
        return;
      }

      // Only request if not already granted
      if (permStatus.receive !== 'granted') {
        try {
          const result = await PushNotifications.requestPermissions();
          if (result.receive !== 'granted') {
            console.log('[Push] Permission denied');
            return;
          }
        } catch (permErr) {
          console.warn('[Push] Permission request failed:', permErr);
          return;
        }
      }

      // Add listeners BEFORE calling register to catch all events
      try {
        PushNotifications.addListener('registration', async (token) => {
          console.log('[Push] Token:', token.value);
          try {
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
          } catch (dbErr) {
            console.error('[Push] Failed to save token:', dbErr);
          }
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
      } catch (listenerErr) {
        console.error('[Push] Failed to add listeners:', listenerErr);
        return;
      }

      // Register — this is the call that crashes if FCM is not configured
      try {
        await PushNotifications.register();
        initialized = true;
        console.log('[Push] Registration successful');
      } catch (regErr) {
        console.error('[Push] Register() failed:', regErr);
      }
    } catch (err) {
      console.error('[Push] Init error:', err);
    }
  }, 8000);
}
