import { Message, ModelType } from '../types';
import { getAuthToken } from '../utils/authUtils';

export const DEFAULT_MODEL: ModelType = 'gpt-4.1-nano';

export const getModelDisplayName = (model: ModelType): string => {
  const modelDisplayNames: Record<string, string> = {
    'gpt-4.1-nano': 'GPT-4.1 Nano',
    'gpt-4o-mini': 'GPT-4o mini',
    'gpt-4': 'GPT-4',
    'gpt-3.5-turbo': 'GPT-3.5 Turbo'
  };
  return modelDisplayNames[model] || model;
};

const MAX_IMAGE_SIZE = 4 * 1024 * 1024;
const MAX_DIMENSION = 2000;

function authHeaders(extra: Record<string, string> = {}): Record<string, string> {
  const token = getAuthToken();
  const headers: Record<string, string> = { ...extra };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  return headers;
}

export async function testApiKey(): Promise<{ success: boolean; message: string; models?: string[] }> {
  try {
    const response = await fetch('/api/models', { headers: authHeaders() });
    if (response.status === 401) return { success: false, message: '認証が必要です。再ログインしてください。' };
    if (!response.ok) return { success: false, message: 'サーバーのAPIキーが無効です' };
    const data = await response.json();
    const chatModels = data.data?.filter((m: any) => m.id.includes('gpt')).map((m: any) => m.id) || [];
    return { success: true, message: 'APIキーは有効です！', models: chatModels };
  } catch (error: any) {
    return { success: false, message: error?.message || '接続エラー' };
  }
}

function validateAndPrepareImage(dataUrl: string): string | null {
  if (!dataUrl.startsWith('data:image/')) return null;
  const base64Data = dataUrl.split(',')[1];
  if (!base64Data) return null;
  const approximateBytes = (base64Data.length * 3) / 4;
  if (approximateBytes > MAX_IMAGE_SIZE) return null;
  return dataUrl;
}

async function resizeAndFormatImage(dataUrl: string, maxWidthHeight = MAX_DIMENSION): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      let width = img.width;
      let height = img.height;
      if (width > maxWidthHeight || height > maxWidthHeight) {
        if (width > height) { height = Math.round((height * maxWidthHeight) / width); width = maxWidthHeight; }
        else { width = Math.round((width * maxWidthHeight) / height); height = maxWidthHeight; }
      }
      canvas.width = width; canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) { reject(new Error('Canvas context error')); return; }
      ctx.drawImage(img, 0, 0, width, height);
      resolve(canvas.toDataURL('image/jpeg', 0.8));
    };
    img.onerror = reject;
    img.src = dataUrl;
  });
}

function isIOSDevice(): boolean {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
}

export async function sendMessageToOpenAI(
  _apiKey: string,
  messages: Message[],
  model: ModelType = DEFAULT_MODEL
): Promise<string> {
  const formattedMessages: any[] = [];
  formattedMessages.push({
    role: 'system',
    content: 'あなたは日本人ユーザーとチャットしています。特別な指示がない限り、日本語で回答してください。'
  });

  const isIOS = isIOSDevice();
  for (const msg of messages) {
    if (msg.role === 'user') {
      if (msg.images && msg.images.length > 0) {
        const contentArray: any[] = [];
        if (msg.content) contentArray.push({ type: 'text', text: msg.content });
        for (const image of msg.images) {
          try {
            let processed = image;
            if (isIOS) processed = await resizeAndFormatImage(image);
            const validated = validateAndPrepareImage(processed);
            if (validated) contentArray.push({ type: 'image_url', image_url: { url: validated } });
          } catch (err) { console.error('画像処理エラー:', err); }
        }
        formattedMessages.push({ role: 'user', content: contentArray });
      } else {
        formattedMessages.push({ role: 'user', content: msg.content });
      }
    } else {
      formattedMessages.push({ role: 'assistant', content: msg.content });
    }
  }

  const response = await fetch('/api/chat', {
    method: 'POST',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ model, messages: formattedMessages, temperature: 0.7, max_tokens: 2048 }),
  });

  if (response.status === 401) {
    throw new Error('認証の有効期限が切れました。再ログインしてください。');
  }

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err?.error?.message || err?.error || `APIエラー: ${response.status}`);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content || '';
}
