import { useCallback } from 'react';
import { CONFIG, API_URLS } from '../lib/config';

const useApi = (token) => {
  const request = useCallback(
    async (endpoint, options = {}) => {
      const headers = {
        'Content-Type': 'application/json',
        apikey: CONFIG.SB_ANON_KEY,
        ...options.headers
      };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      try {
        const response = await fetch(`${API_URLS.BASE}${endpoint}`, { ...options, headers });
        if (response.ok) {
          const contentType = response.headers.get('content-type');
          if (contentType && contentType.includes('application/json')) return await response.json();
          const text = await response.text();
          return text ? JSON.parse(text) : {};
        }
        throw new Error(`API Error ${response.status}: ${await response.text()}`);
      } catch (error) {
        console.error(error);
        throw error;
      }
    },
    [token]
  );

  return { request };
};

export default useApi;