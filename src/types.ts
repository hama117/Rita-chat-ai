// User and Assistant message types
export type MessageRole = 'user' | 'assistant';

export interface Message {
  id: string;
  role: MessageRole;
  content: string;
  timestamp: number;
  images?: string[];
  pdfs?: PDFDocument[];
  isNew?: boolean; // アニメーション制御用フラグ
}

// API models
export type ModelType = 'gpt-4o' | 'gpt-3.5-turbo';

// Settings
export interface Settings {
  apiKey: string;
  model: ModelType;
}

// Chat data structure
export interface Chat {
  id: string;
  title: string;
  messages: Message[];
  createdAt: number;
}

// PDF document type
export interface PDFDocument {
  id: string;
  name: string;
  dataUrl: string;
  text: string;
  pageCount: number;
}

// Template data structure
export interface Template {
  id: string;
  name: string;
  initialPrompt: string; // 最初に自動入力されるプロンプト
  followUpPrompt: string; // ユーザーが回答した後に自動入力されるプロンプト
  instructions: string; // 詳細な手順やGPTSのようなインストラクション
  createdAt: number;
}