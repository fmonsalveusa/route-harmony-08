/**
 * Native Push Notifications helper
 * Registers device for push notifications using @capacitor/push-notifications
 * and saves FCM token to the database
 */

import { isNativePlatform } from './nativeTracking';
import { supabase } from '@/integrations/supabase/client';
import { getTenantId } from '@/hooks/useTenantId';

let initialized = false;

export async function initPushNotifications(driverId: string | null) {
  if (!isNativePlatform() || initialized || !driverId) return;
  initialized = true;

  try {
    const { PushNotifications } = await import('@capacitor/push-notifications');

    // Request permission
    const permResult = await PushNotifications.requestPermissions();
    if (permResult.receive !== 'granted') {
      console.log('[Push] Permission denied');
      return;
    }

    // Register for push
    await PushNotifications.register();

    // Listen for registration success
    PushNotifications.addListener('registration', async (token) => {
      console.log('[Push] Token:', token.value);
      const tenant_id = await getTenantId();
      // Upsert token
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

    // Listen for registration errors
    PushNotifications.addListener('registrationError', (err) => {
      console.error('[Push] Registration error:', err);
    });

    // Handle received notifications while app is open
    PushNotifications.addListener('pushNotificationReceived', (notification) => {
      console.log('[Push] Received in foreground:', notification);
    });

    // Handle notification tap
    PushNotifications.addListener('pushNotificationActionPerformed', (action) => {
      console.log('[Push] Action performed:', action);
      const data = action.notification.data;
      if (data?.load_id) {
        window.location.href = `/driver/loads/${data.load_id}`;
      }
    });
  } catch (err) {
    console.error('[Push] Init error:', err);
    initialized = false;
  }
}
