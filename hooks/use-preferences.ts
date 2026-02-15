import { useState, useEffect, useCallback } from 'react';
import apiClient from '@/lib/api-client';
import { AuthApis } from '@/lib/api/endpoints';

interface UserPreferences {
  is_kot_notification_enabled: boolean;
  is_order_notification_enabled: boolean;
  // Local-only prefs
  kitchen_sound?: boolean;
  auto_backup?: boolean;
  push_alerts?: boolean;
  email_summaries?: boolean;
}

export const usePreferences = () => {
  const [preferences, setPreferences] = useState<UserPreferences>({
    is_kot_notification_enabled: false,
    is_order_notification_enabled: false,
    kitchen_sound: true,
    auto_backup: false,
    push_alerts: true,
    email_summaries: true,
  });
  const [loading, setLoading] = useState(true);

  const fetchPreferences = useCallback(async () => {
    try {
      setLoading(true);
      const response = await apiClient.get(AuthApis.preferences);
      if (response.data.status === 'success') {
        const backendPrefs = response.data.data;
        
        // Load local-only prefs from localStorage
        const localPrefs = {
          kitchen_sound: localStorage.getItem('pref_kitchen_sound') !== 'false',
          auto_backup: localStorage.getItem('pref_auto_backup') === 'true',
          push_alerts: localStorage.getItem('pref_push_alerts') !== 'false',
          email_summaries: localStorage.getItem('pref_email_summaries') !== 'false',
        };

        setPreferences({
          ...backendPrefs,
          ...localPrefs,
        });
      }
    } catch (err) {
      console.error('Failed to fetch preferences:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPreferences();
  }, [fetchPreferences]);

  const updatePreference = async (key: keyof UserPreferences, value: any) => {
    // Determine if it's a backend or local pref
    const isBackendPref = ['is_kot_notification_enabled', 'is_order_notification_enabled'].includes(key);

    if (isBackendPref) {
      try {
        const response = await apiClient.patch(AuthApis.updatePreferences, {
          [key]: value,
        });
        if (response.data.status === 'success') {
          setPreferences(prev => ({ ...prev, [key]: value }));
        }
      } catch (err) {
        console.error('Failed to update backend preference:', err);
        throw err;
      }
    } else {
      // Local pref
      localStorage.setItem(`pref_${key}`, String(value));
      setPreferences(prev => ({ ...prev, [key]: value }));
    }
  };

  return { preferences, loading, updatePreference, refresh: fetchPreferences };
};
