import { Chat, Settings, ModelType, PDFDocument, Template } from '../types';
import { DEFAULT_MODEL, getModelDisplayName as getOpenAIModelDisplayName } from '../services/openai';

const SETTINGS_KEY = 'gemini-chat-settings';
const CHATS_KEY = 'gemini-chat-chats';
const ACTIVE_CHAT_KEY = 'gemini-chat-active-chat';
const PDF_CONTENT_PREFIX = 'gemini-chat-pdf-';
const TEMPLATES_KEY = 'gemini-chat-templates'; // テンプレート用のストレージキー
const MAX_CHATS = 50; // Maximum number of chats to keep

// Settings Storage
export const getSettings = (): Settings => {
  const settings = localStorage.getItem(SETTINGS_KEY);
  return settings ? JSON.parse(settings) : { apiKey: '', model: DEFAULT_MODEL };
};

export const saveSettings = (settings: Settings): void => {
  // APIキーはセキュリティ向上のためにローカルストレージに保存しない
  const secureSettings = {
    ...settings,
    apiKey: '', // APIキーを削除して保存（メモリにのみ保持）
    model: DEFAULT_MODEL // 常にデフォルトモデルを使用
  };
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(secureSettings));
};

// API Key関連
export const clearApiKey = (): void => {
  const settings = getSettings();
  settings.apiKey = '';
  settings.model = DEFAULT_MODEL;
  saveSettings(settings);
};

// Helper to optimize chat for storage
const optimizeChatForStorage = (chat: Chat): Chat => {
  // Create a copy of the chat to avoid modifying the original
  const optimizedChat: Chat = {
    ...chat,
    messages: chat.messages.map(msg => {
      // Create a copy of the message
      const newMsg = { ...msg };

      // For messages with PDFs, store the PDFs separately
      if (newMsg.pdfs && newMsg.pdfs.length > 0) {
        // Store a reference to the PDF but remove the large dataUrl
        newMsg.pdfs = newMsg.pdfs.map(pdf => {
          // Store PDF dataUrl separately
          try {
            localStorage.setItem(`${PDF_CONTENT_PREFIX}${pdf.id}`, pdf.dataUrl);
          } catch (e) {
            console.warn('Could not store PDF dataUrl, it may be too large:', e);
          }

          // Return PDF without the dataUrl to save space
          return {
            ...pdf,
            dataUrl: '' // Remove dataUrl from the chat storage
          };
        });
      }
      
      return newMsg;
    })
  };
  
  return optimizedChat;
};

// Helper to restore full chat data
const restoreFullChat = (chat: Chat): Chat => {
  // Create a copy of the chat
  const restoredChat: Chat = {
    ...chat,
    messages: chat.messages.map(msg => {
      // Create a copy of the message
      const newMsg = { ...msg };
      
      // Restore PDFs if any
      if (newMsg.pdfs && newMsg.pdfs.length > 0) {
        newMsg.pdfs = newMsg.pdfs.map(pdf => {
          // Try to get PDF dataUrl from storage
          const dataUrl = localStorage.getItem(`${PDF_CONTENT_PREFIX}${pdf.id}`);
          
          return {
            ...pdf,
            dataUrl: dataUrl || ''
          };
        });
      }
      
      return newMsg;
    })
  };
  
  return restoredChat;
};

// Function to estimate the size of a string in bytes
const getStringSizeInBytes = (str: string): number => {
  return new Blob([str]).size;
};

// Chats Storage
export const getChats = (): Chat[] => {
  try {
    const chatsJson = localStorage.getItem(CHATS_KEY);
    if (!chatsJson) return [];
    
    const chats: Chat[] = JSON.parse(chatsJson);
    
    // Restore full chat data including PDFs
    return chats.map(chat => restoreFullChat(chat));
  } catch (error) {
    console.error('Error retrieving chats from storage:', error);
    return [];
  }
};

export const saveChats = (chats: Chat[]): void => {
  try {
    // Keep only the latest MAX_CHATS chats
    const trimmedChats = chats.length > MAX_CHATS 
      ? chats.slice(0, MAX_CHATS) 
      : chats;
    
    // Optimize chats before storage
    const optimizedChats = trimmedChats.map(chat => optimizeChatForStorage(chat));
    
    // Try to save the chats
    try {
      localStorage.setItem(CHATS_KEY, JSON.stringify(optimizedChats));
    } catch (e) {
      if (e instanceof DOMException && (
          e.name === 'QuotaExceededError' || 
          e.name === 'NS_ERROR_DOM_QUOTA_REACHED')) {
        
        console.warn('Storage quota exceeded, trying to free up space...');
        
        // If we have too many chats, remove the oldest ones
        if (optimizedChats.length > 10) {
          // Remove half of the older chats
          const reducedChats = optimizedChats.slice(0, Math.ceil(optimizedChats.length / 2));
          localStorage.setItem(CHATS_KEY, JSON.stringify(reducedChats));
          console.log(`Reduced chats from ${optimizedChats.length} to ${reducedChats.length}`);
          return;
        }
        
        // If still failing, aggressively clean up
        // First, get a list of all chat-related keys
        const pdfKeys = [];
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key && key.startsWith(PDF_CONTENT_PREFIX)) {
            pdfKeys.push(key);
          }
        }
        
        // Remove older PDF content
        if (pdfKeys.length > 10) {
          // Remove the oldest half of PDF data
          const toRemove = pdfKeys.slice(Math.ceil(pdfKeys.length / 2));
          toRemove.forEach(key => localStorage.removeItem(key));
          console.log(`Removed ${toRemove.length} old PDF data entries`);
        }
        
        // Try again with even fewer chats if needed
        try {
          const minimalChats = optimizedChats.slice(0, 5); // Keep only the 5 most recent
          localStorage.setItem(CHATS_KEY, JSON.stringify(minimalChats));
          console.log('Saved only the 5 most recent chats due to storage limitations');
        } catch (finalError) {
          // If still failing, keep only the newest chat
          try {
            const singleChat = optimizedChats.slice(0, 1);
            localStorage.setItem(CHATS_KEY, JSON.stringify(singleChat));
            console.log('Saved only the most recent chat due to severe storage limitations');
          } catch (lastAttemptError) {
            console.error('Could not save any chats due to storage limitations');
            alert('チャット履歴を保存するためのストレージ容量が不足しています。古い履歴を削除するか、PDFの使用を控えてください。');
          }
        }
      } else {
        // Handle other types of errors
        console.error('Error saving chats:', e);
        throw e;
      }
    }
  } catch (error) {
    console.error('Failed to save chats:', error);
  }
};

export const saveChat = (chat: Chat): void => {
  try {
    const chats = getChats();
    const index = chats.findIndex((c) => c.id === chat.id);
    
    if (index >= 0) {
      // Update existing chat
      chats[index] = chat;
    } else {
      // Add new chat to the beginning of the array
      chats.unshift(chat);
    }
    
    saveChats(chats);
    setActiveChatId(chat.id);
  } catch (error) {
    console.error('Failed to save chat:', error);
    alert('チャットの保存中にエラーが発生しました。PDFファイルが大きすぎる可能性があります。');
  }
};

export const deleteChat = (chatId: string): void => {
  // First, find the chat to get its PDFs if any
  const chats = getChats();
  const chatToDelete = chats.find(c => c.id === chatId);
  
  // Clean up any PDF data stored for this chat
  if (chatToDelete) {
    chatToDelete.messages.forEach(msg => {
      if (msg.pdfs) {
        msg.pdfs.forEach(pdf => {
          localStorage.removeItem(`${PDF_CONTENT_PREFIX}${pdf.id}`);
        });
      }
    });
  }
  
  // Now remove the chat from storage
  saveChats(chats.filter((chat) => chat.id !== chatId));
  
  // アクティブチャットが削除された場合、そのIDをクリア
  if (getActiveChatId() === chatId) {
    localStorage.removeItem(ACTIVE_CHAT_KEY);
  }
};

// Active Chat Storage
export const getActiveChatId = (): string | null => {
  return localStorage.getItem(ACTIVE_CHAT_KEY);
};

export const setActiveChatId = (chatId: string | null): void => {
  if (chatId) {
    localStorage.setItem(ACTIVE_CHAT_KEY, chatId);
  } else {
    localStorage.removeItem(ACTIVE_CHAT_KEY);
  }
};

// ローカルストレージを完全にクリア
export const clearAllData = (): void => {
  // Remove all PDF data
  const keysToRemove = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.startsWith(PDF_CONTENT_PREFIX)) {
      keysToRemove.push(key);
    }
  }
  keysToRemove.forEach(key => localStorage.removeItem(key));
  
  // Remove chat data
  localStorage.removeItem(CHATS_KEY);
  localStorage.removeItem(ACTIVE_CHAT_KEY);
  // APIキーと選択したモデルの設定は残す
};

// モデル名の表示用テキストを取得 - OpenAIサービスの関数を使用
export const getModelDisplayName = getOpenAIModelDisplayName;

// Templates Storage
export const getTemplates = (): Template[] => {
  try {
    const templatesJson = localStorage.getItem(TEMPLATES_KEY);
    return templatesJson ? JSON.parse(templatesJson) : [];
  } catch (error) {
    console.error('Error retrieving templates from storage:', error);
    return [];
  }
};

export const saveTemplates = (templates: Template[]): void => {
  try {
    localStorage.setItem(TEMPLATES_KEY, JSON.stringify(templates));
  } catch (error) {
    console.error('Failed to save templates:', error);
    alert('テンプレートの保存中にエラーが発生しました。');
  }
};

export const saveTemplate = (template: Template): void => {
  try {
    const templates = getTemplates();
    const index = templates.findIndex((t) => t.id === template.id);
    
    if (index >= 0) {
      // Update existing template
      templates[index] = template;
    } else {
      // Add new template to the beginning of the array
      templates.unshift(template);
    }
    
    saveTemplates(templates);
  } catch (error) {
    console.error('Failed to save template:', error);
    alert('テンプレートの保存中にエラーが発生しました。');
  }
};

export const deleteTemplate = (templateId: string): void => {
  const templates = getTemplates();
  saveTemplates(templates.filter((template) => template.id !== templateId));
};

export const clearAllTemplates = (): void => {
  localStorage.removeItem(TEMPLATES_KEY);
};