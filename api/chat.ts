import type { VercelRequest, VercelResponse } from '@vercel/node';
import crypto from 'crypto';
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || 'https://clark-ai-chat-2026.vercel.app';
const AUTH_SECRET = process.env.AUTH_SECRET;

// ===== 使用を許可するモデルと上限値（コスト暴走を防ぐ要） =====
// このアプリが実際に使うモデルは gpt-4.1-nano のみ。
// クライアントが別モデル（gpt-4 など高額モデル）を送ってきても、
// サーバー側で必ずこの値に固定し、すり替えを無効化する。
const ALLOWED_MODEL = 'gpt-4.1-nano';
const MAX_TOKENS_CAP = 2048;   // 1リクエストあたりの最大出力トークン
const MAX_MESSAGES = 60;       // 1リクエストあたりの最大メッセージ数
const MAX_TEXT_CHARS = 100000; // 全メッセージのテキスト合計文字数の上限

function countText(messages: any[]): number {
  let total = 0;
  for (const m of messages) {
    if (typeof m?.content === 'string') {
      total += m.content.length;
    } else if (Array.isArray(m?.content)) {
      for (const part of m.content) {
        if (part?.type === 'text' && typeof part.text === 'string') total += part.text.length;
      }
    }
  }
  return total;
}

function verifyToken(token: string | undefined, secret: string): { userId: string; exp: number } | null {
  if (!token) return null;
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [body, sig] = parts;
  if (!body || !sig) return null;
  const expected = crypto.createHmac('sha256', secret).update(body).digest('base64url');
  const sigBuf = Buffer.from(sig);
  const expBuf = Buffer.from(expected);
  if (sigBuf.length !== expBuf.length) return null;
  if (!crypto.timingSafeEqual(sigBuf, expBuf)) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf-8'));
    if (typeof payload.exp !== 'number' || payload.exp < Date.now()) return null;
    if (!payload.userId) return null;
    return payload;
  } catch {
    return null;
  }
}
export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', ALLOWED_ORIGIN);
  res.setHeader('Vary', 'Origin');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!AUTH_SECRET) {
    return res.status(500).json({ error: 'サーバー認証設定が不足しています' });
  }
  // 認証トークン検証
  const authHeader = (req.headers.authorization as string) || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : undefined;
  const payload = verifyToken(token, AUTH_SECRET);
  if (!payload) {
    return res.status(401).json({ error: '認証が必要です。再ログインしてください。' });
  }
  // ===== リクエスト内容の検証とサニタイズ =====
  // クライアントが送る model / max_tokens / n は一切信用しない。
  // 攻撃者が高額モデルや巨大な出力量を指定しても、ここで弾く・固定する。
  const incoming = (req.body || {}) as any;
  const messages = Array.isArray(incoming.messages) ? incoming.messages : null;
  if (!messages || messages.length === 0) {
    return res.status(400).json({ error: 'messages が指定されていません' });
  }
  if (messages.length > MAX_MESSAGES) {
    return res.status(400).json({ error: 'メッセージ数が上限を超えています' });
  }
  if (countText(messages) > MAX_TEXT_CHARS) {
    return res.status(413).json({ error: 'リクエストが大きすぎます' });
  }

  const requestedMax =
    typeof incoming.max_tokens === 'number' ? incoming.max_tokens : MAX_TOKENS_CAP;
  const temperature =
    typeof incoming.temperature === 'number'
      ? Math.min(Math.max(incoming.temperature, 0), 2)
      : 0.7;

  // サーバー側で組み直した安全なリクエストボディのみを OpenAI へ送る
  const safeBody = {
    model: ALLOWED_MODEL, // ← 必ず固定。高額モデルへのすり替え不可
    messages,
    temperature,
    max_tokens: Math.min(Math.max(requestedMax, 1), MAX_TOKENS_CAP),
    n: 1,
    stream: false,
  };

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'サーバーにAPIキーが設定されていません' });
  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(safeBody),
    });
    const data = await response.json();
    if (!response.ok) return res.status(response.status).json(data);
    return res.status(200).json(data);
  } catch (error: any) {
    return res.status(500).json({ error: 'APIリクエスト中にエラーが発生しました' });
  }
}
