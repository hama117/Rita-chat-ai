import { getAuthToken } from '../utils/authUtils';

export async function testApiKey(): Promise<boolean> {
  try {
    const token = getAuthToken();
    const headers: Record<string, string> = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;
    const response = await fetch('/api/models', { method: 'GET', headers });
    return response.ok;
  } catch (error) {
    console.error('APIキーのテストに失敗しました:', error);
    return false;
  }
}

export function getApiKeyFromEnv(): null {
  return null;
}

export function getCachedApiKey(): null {
  return null;
}

export function clearCachedApiKey(): void {}

export function setCachedApiKey(_apiKey: string): void {}

export async function getApiKey(): Promise<string> {
  return '';
}

export function clearApiKeyFromLocalStorage(): void {
  try {
    localStorage.removeItem('api_key');
    localStorage.removeItem('api_key_timestamp');
  } catch (error) {
    console.error('ローカルストレージのクリア失敗:', error);
  }
}
