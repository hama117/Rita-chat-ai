import type { VercelRequest, VercelResponse } from '@vercel/node';
import crypto from 'crypto';

const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || 'https://clark-ai-chat-2026.vercel.app';
const AUTH_SECRET = process.env.AUTH_SECRET;
const GAS_LOGIN_URL =
  process.env.GAS_LOGIN_URL ||
  'https://script.google.com/macros/s/AKfycbx3vD9pTh4H9xNY956sjRwco3yPwXWB7Ro0Ap89HqZyeLVfm0pERIVfuMtJ0qbQhN8_0Q/exec';

const TOKEN_TTL_MS = 24 * 60 * 60 * 1000; // 24時間

function signToken(payload: object, secret: string): string {
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = crypto.createHmac('sha256', secret).update(body).digest('base64url');
  return `${body}.${sig}`;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', ALLOWED_ORIGIN);
  res.setHeader('Vary', 'Origin');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Method not allowed' });
  }

  if (!AUTH_SECRET) {
    return res.status(500).json({ success: false, message: 'サーバー認証設定が不足しています' });
  }

  const { userId, password } = (req.body || {}) as { userId?: string; password?: string };
  if (!userId || !password) {
    return res.status(400).json({ success: false, message: 'ユーザーIDとパスワードを入力してください' });
  }

  try {
    // 既存の GAS に対してサーバー側から認証問い合わせ（GAS自体は変更不要）
    const gasResponse = await fetch(GAS_LOGIN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify({ userId, password }),
    });
    const text = await gasResponse.text();
    let data: any;
    try {
      data = JSON.parse(text);
    } catch {
      return res.status(502).json({ success: false, message: '認証サービスの応答を解析できませんでした' });
    }

    if (!data.success) {
      return res.status(401).json({ success: false, message: data.message || '認証に失敗しました' });
    }

    const verifiedUserId: string = data.userId || userId;
    const exp = Date.now() + TOKEN_TTL_MS;
    const token = signToken({ userId: verifiedUserId, exp }, AUTH_SECRET);

    return res.status(200).json({ success: true, userId: verifiedUserId, token, exp });
  } catch (err: any) {
    return res.status(502).json({ success: false, message: '認証サービスへの接続エラー' });
  }
}
