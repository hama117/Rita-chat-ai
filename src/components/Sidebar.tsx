import React, { useState, useRef, useEffect } from 'react';
import { MessageSquarePlus, RefreshCw, Trash2, AlertTriangle, ExternalLink, LogOut, Download, Upload, PlusCircle, CreditCard as Edit, X, Archive, FileCode } from 'lucide-react';
import { Chat, Template } from '../types';
import { saveChats, getChats, getTemplates, saveTemplate, deleteTemplate } from '../utils/storage';
import { v4 as uuidv4 } from 'uuid';
import TemplateModal from './TemplateModal';

// AIサービスの型定義
interface AiService {
  id: string;
  name: string;
  url: string;
  description?: string;
}

interface SidebarProps {
  chats: Chat[];
  activeChatId: string | null;
  onChatSelect: (chatId: string) => void;
  onNewChat: () => void;
  onDeleteChat: (chatId: string) => void;
  onOpenSettings: () => void;
  onClearAllData: () => void;
  onLogout: () => void;
  onTemplateSelect?: (template: Template) => void; // テンプレート選択ハンドラー
  userId?: string;
}

// AIサービス用のローカルストレージキー
const AI_SERVICES_STORAGE_KEY = 'clark-ai-services-v3';

// デフォルトのAIサービス一覧
const DEFAULT_AI_SERVICES: AiService[] = [
  {
    id: '1',
    name: '絵本 recraft',
    url: 'https://www.recraft.ai/projects',
  },
  {
    id: '2',
    name: '音楽 SUNO',
    url: 'https://suno.com/create',
  },
  {
    id: '3',
    name: '画像 Whisk',
    url: 'https://labs.google/fx/ja/tools/whisk',
  },
  {
    id: '4',
    name: 'NotebookLM',
    url: 'https://notebooklm.google.com/',
  },
];

const Sidebar: React.FC<SidebarProps> = ({
  chats,
  activeChatId,
  onChatSelect,
  onNewChat,
  onDeleteChat,
  onOpenSettings,
  onClearAllData,
  onLogout,
  onTemplateSelect,
  userId
}) => {
  const [chatToDelete, setChatToDelete] = useState<string | null>(null);
  const [chatToExport, setChatToExport] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showClearAllConfirm, setShowClearAllConfirm] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [importSuccess, setImportSuccess] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const singleChatImportInputRef = useRef<HTMLInputElement>(null);
  
  // AIサービス関連のステート
  const [aiServices, setAiServices] = useState<AiService[]>([]);
  const [showAddServiceForm, setShowAddServiceForm] = useState(false);
  const [newServiceName, setNewServiceName] = useState('');
  const [newServiceUrl, setNewServiceUrl] = useState('');
  const [newServiceDescription, setNewServiceDescription] = useState('');
  const [serviceToDelete, setServiceToDelete] = useState<string | null>(null);
  const [showDeleteServiceConfirm, setShowDeleteServiceConfirm] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);
  
  // テンプレート関連のステート
  const [templates, setTemplates] = useState<Template[]>([]);
  const [isTemplateModalOpen, setIsTemplateModalOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<Template | null>(null);
  const [showTemplates, setShowTemplates] = useState(true);
  const [templateToDelete, setTemplateToDelete] = useState<string | null>(null);
  const [showDeleteTemplateConfirm, setShowDeleteTemplateConfirm] = useState(false);

  // AIサービスをローカルストレージから読み込む
  useEffect(() => {
    try {
      const storedServices = localStorage.getItem(AI_SERVICES_STORAGE_KEY);
      if (storedServices) {
        setAiServices(JSON.parse(storedServices));
      } else {
        // 初回はデフォルトサービスをセット
        setAiServices(DEFAULT_AI_SERVICES);
        localStorage.setItem(AI_SERVICES_STORAGE_KEY, JSON.stringify(DEFAULT_AI_SERVICES));
      }
    } catch (error) {
      console.error('AIサービスの読み込みに失敗しました:', error);
      // エラー時はデフォルトを使用
      setAiServices(DEFAULT_AI_SERVICES);
    }
  }, []);
  
  // テンプレートをローカルストレージから読み込む
  useEffect(() => {
    const loadedTemplates = getTemplates();
    setTemplates(loadedTemplates);
  }, []);

  // AIサービスをローカルストレージに保存
  const saveAiServices = (services: AiService[]) => {
    try {
      localStorage.setItem(AI_SERVICES_STORAGE_KEY, JSON.stringify(services));
    } catch (error) {
      console.error('AIサービスの保存に失敗しました:', error);
    }
  };

  // 削除操作の処理
  const handleDeleteClick = (e: React.MouseEvent, chatId: string) => {
    e.stopPropagation(); // チャット選択イベントが発火しないようにする
    setChatToDelete(chatId);
    setShowDeleteConfirm(true);
  };

  // エクスポート操作の処理
  const handleExportChatClick = (e: React.MouseEvent, chatId: string) => {
    e.stopPropagation(); // チャット選択イベントが発火しないようにする
    exportSingleChat(chatId);
  };

  // すべてのデータを削除する操作の処理
  const handleClearAllClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowClearAllConfirm(true);
  };
  
  // ログアウト操作の処理
  const handleLogoutClick = () => {
    setShowLogoutConfirm(true);
  };

  // 削除の確認
  const confirmDelete = () => {
    if (chatToDelete) {
      onDeleteChat(chatToDelete);
      setChatToDelete(null);
      setShowDeleteConfirm(false);
    }
  };

  // 全データ削除の確認
  const confirmClearAll = () => {
    onClearAllData();
    setShowClearAllConfirm(false);
  };
  
  // ログアウトの確認
  const confirmLogout = () => {
    onLogout();
    setShowLogoutConfirm(false);
  };

  // 削除キャンセル
  const cancelDelete = () => {
    setChatToDelete(null);
    setShowDeleteConfirm(false);
  };

  // 全データ削除キャンセル
  const cancelClearAll = () => {
    setShowClearAllConfirm(false);
  };
  
  // ログアウトキャンセル
  const cancelLogout = () => {
    setShowLogoutConfirm(false);
  };

  // 単一チャットのエクスポート
  const exportSingleChat = (chatId: string) => {
    try {
      // 対象のチャットを見つける
      const chatToExport = chats.find(chat => chat.id === chatId);
      if (!chatToExport) {
        setImportError('エクスポートするチャットが見つかりませんでした');
        setTimeout(() => {
          setImportError(null);
        }, 3000);
        return;
      }
      
      // チャットデータをJSON文字列に変換
      const chatData = JSON.stringify([chatToExport], null, 2);
      
      // Blobを作成
      const blob = new Blob([chatData], { type: 'application/json' });
      
      // ダウンロード用のURLを作成
      const url = URL.createObjectURL(blob);
      
      // ダウンロードリンクを作成
      const a = document.createElement('a');
      a.href = url;
      
      // タイトルとIDをファイル名に含める
      const safeTitlePart = chatToExport.title.replace(/[^a-z0-9]/gi, '_').substring(0, 20);
      const date = new Date().toISOString().split('T')[0];
      a.download = `chat-${safeTitlePart}-${date}.json`;
      
      // リンクをクリックしてダウンロード開始
      document.body.appendChild(a);
      a.click();
      
      // リンク要素を削除
      document.body.removeChild(a);
      
      // URLを解放
      URL.revokeObjectURL(url);
      
      // 成功メッセージを表示
      setImportSuccess(`チャット「${chatToExport.title}」をエクスポートしました`);
      
      // 3秒後にメッセージを消す
      setTimeout(() => {
        setImportSuccess(null);
      }, 3000);
    } catch (error) {
      console.error('チャットのエクスポートに失敗しました:', error);
      setImportError('エクスポートに失敗しました');
      
      // 3秒後にエラーメッセージを消す
      setTimeout(() => {
        setImportError(null);
      }, 3000);
    }
  };

  // チャット履歴のエクスポート機能
  const handleExportChats = () => {
    try {
      // チャットデータをJSON文字列に変換
      const chatData = JSON.stringify(chats, null, 2);
      
      // Blobを作成
      const blob = new Blob([chatData], { type: 'application/json' });
      
      // ダウンロード用のURLを作成
      const url = URL.createObjectURL(blob);
      
      // ダウンロードリンクを作成
      const a = document.createElement('a');
      a.href = url;
      
      // 現在の日時をファイル名に含める
      const date = new Date().toISOString().split('T')[0];
      a.download = `chat-history-${date}.json`;
      
      // リンクをクリックしてダウンロード開始
      document.body.appendChild(a);
      a.click();
      
      // リンク要素を削除
      document.body.removeChild(a);
      
      // URLを解放
      URL.revokeObjectURL(url);
      
      // 成功メッセージを表示
      setImportSuccess('チャット履歴をエクスポートしました');
      
      // 3秒後にメッセージを消す
      setTimeout(() => {
        setImportSuccess(null);
      }, 3000);
    } catch (error) {
      console.error('チャット履歴のエクスポートに失敗しました:', error);
      setImportError('エクスポートに失敗しました');
      
      // 3秒後にエラーメッセージを消す
      setTimeout(() => {
        setImportError(null);
      }, 3000);
    }
  };

  // ファイル選択ダイアログを開く
  const handleImportClick = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  // 単一チャットのインポート用ファイル選択ダイアログを開く
  const handleSingleChatImportClick = () => {
    if (singleChatImportInputRef.current) {
      singleChatImportInputRef.current.click();
    }
  };

  // インポートするファイルが選択されたときの処理
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setImportError(null);
    
    const file = e.target.files?.[0];
    if (!file) return;
    
    // JSONファイルかどうかを確認
    if (file.type !== 'application/json' && !file.name.endsWith('.json')) {
      setImportError('JSONファイルを選択してください');
      
      // 3秒後にエラーメッセージを消す
      setTimeout(() => {
        setImportError(null);
      }, 3000);
      
      // ファイル入力をリセット
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      return;
    }
    
    const reader = new FileReader();
    
    reader.onload = (event) => {
      try {
        const content = event.target?.result as string;
        const importedChats = JSON.parse(content) as Chat[];
        
        // インポートされたデータが配列かどうかを確認
        if (!Array.isArray(importedChats)) {
          throw new Error('不正なデータ形式です');
        }
        
        // チャットの形式を簡易的に検証
        for (const chat of importedChats) {
          if (!chat.id || !chat.title || !Array.isArray(chat.messages)) {
            throw new Error('チャットデータの形式が正しくありません');
          }
        }
        
        // チャットをローカルストレージに保存
        // 既存のチャットとマージするか、置き換えるかのオプションも追加可能
        saveChats(importedChats);
        
        // 成功メッセージを表示
        setImportSuccess(`${importedChats.length}件のチャットをインポートしました`);
        
        // 3秒後にメッセージを消す
        setTimeout(() => {
          setImportSuccess(null);
          
          // 画面をリロードしてチャットを反映
          window.location.reload();
        }, 2000);
        
      } catch (error) {
        console.error('チャットデータのインポートに失敗しました:', error);
        setImportError('チャットデータの解析に失敗しました');
        
        // 3秒後にエラーメッセージを消す
        setTimeout(() => {
          setImportError(null);
        }, 3000);
      }
    };
    
    reader.onerror = () => {
      setImportError('ファイルの読み込みに失敗しました');
      
      // 3秒後にエラーメッセージを消す
      setTimeout(() => {
        setImportError(null);
      }, 3000);
    };
    
    reader.readAsText(file);
    
    // ファイル入力をリセット
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // 単一チャットのインポート処理
  const handleSingleChatFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setImportError(null);
    
    const file = e.target.files?.[0];
    if (!file) return;
    
    // JSONファイルかどうかを確認
    if (file.type !== 'application/json' && !file.name.endsWith('.json')) {
      setImportError('JSONファイルを選択してください');
      
      setTimeout(() => {
        setImportError(null);
      }, 3000);
      
      if (singleChatImportInputRef.current) {
        singleChatImportInputRef.current.value = '';
      }
      return;
    }
    
    const reader = new FileReader();
    
    reader.onload = (event) => {
      try {
        const content = event.target?.result as string;
        const importedChats = JSON.parse(content) as Chat[];
        
        // インポートされたデータが配列かどうかを確認
        if (!Array.isArray(importedChats)) {
          throw new Error('不正なデータ形式です');
        }
        
        // チャットの形式を簡易的に検証
        for (const chat of importedChats) {
          if (!chat.id || !chat.title || !Array.isArray(chat.messages)) {
            throw new Error('チャットデータの形式が正しくありません');
          }
        }
        
        // 既存のチャットを取得
        const existingChats = getChats();
        
        // 新しいIDを付与してチャットを既存のものとマージ
        const updatedChats = [
          ...importedChats.map(chat => ({
            ...chat,
            id: uuidv4(), // 新しいIDを生成してコンフリクトを防ぐ
            title: `${chat.title} (インポート)`, // インポートされたことを表示
            createdAt: Date.now() // インポート時の日時を設定
          })),
          ...existingChats
        ];
        
        // 更新されたチャットを保存
        saveChats(updatedChats);
        
        // 成功メッセージを表示
        setImportSuccess(`${importedChats.length}件のチャットをインポートしました`);
        
        // 画面をリロードしてチャットを反映
        setTimeout(() => {
          setImportSuccess(null);
          window.location.reload();
        }, 2000);
        
      } catch (error) {
        console.error('チャットデータのインポートに失敗しました:', error);
        setImportError('チャットデータの解析に失敗しました');
        
        setTimeout(() => {
          setImportError(null);
        }, 3000);
      }
    };
    
    reader.onerror = () => {
      setImportError('ファイルの読み込みに失敗しました');
      
      setTimeout(() => {
        setImportError(null);
      }, 3000);
    };
    
    reader.readAsText(file);
    
    // ファイル入力をリセット
    if (singleChatImportInputRef.current) {
      singleChatImportInputRef.current.value = '';
    }
  };

  // AIサービスを追加するフォームを表示する
  const handleShowAddServiceForm = () => {
    setShowAddServiceForm(true);
    setNewServiceName('');
    setNewServiceUrl('');
    setNewServiceDescription('');
  };

  // AIサービスを追加する
  const handleAddService = () => {
    // 名前とURLが入力されているか確認
    if (!newServiceName.trim() || !newServiceUrl.trim()) {
      setImportError('サービス名とURLを入力してください');
      setTimeout(() => {
        setImportError(null);
      }, 3000);
      return;
    }

    // 入力されたURLが有効か確認
    try {
      new URL(newServiceUrl);
    } catch (error) {
      setImportError('有効なURLを入力してください');
      setTimeout(() => {
        setImportError(null);
      }, 3000);
      return;
    }

    // 新しいサービスを作成
    const newService: AiService = {
      id: Date.now().toString(), // タイムスタンプをIDとして使用
      name: newServiceName.trim(),
      url: newServiceUrl.trim(),
      description: newServiceDescription.trim() || undefined
    };

    // サービス一覧に追加
    const updatedServices = [...aiServices, newService];
    setAiServices(updatedServices);
    saveAiServices(updatedServices);

    // フォームをリセット
    setShowAddServiceForm(false);
    setNewServiceName('');
    setNewServiceUrl('');
    setNewServiceDescription('');

    // 成功メッセージを表示
    setImportSuccess('AIサービスを追加しました');
    setTimeout(() => {
      setImportSuccess(null);
    }, 3000);
  };

  // AIサービスの削除を確認する
  const handleDeleteServiceClick = (serviceId: string) => {
    setServiceToDelete(serviceId);
    setShowDeleteServiceConfirm(true);
  };

  // AIサービスの削除を実行する
  const confirmDeleteService = () => {
    if (serviceToDelete) {
      const updatedServices = aiServices.filter(service => service.id !== serviceToDelete);
      setAiServices(updatedServices);
      saveAiServices(updatedServices);
      setServiceToDelete(null);
      setShowDeleteServiceConfirm(false);

      // 成功メッセージを表示
      setImportSuccess('AIサービスを削除しました');
      setTimeout(() => {
        setImportSuccess(null);
      }, 3000);
    }
  };

  // AIサービスの削除をキャンセル
  const cancelDeleteService = () => {
    setServiceToDelete(null);
    setShowDeleteServiceConfirm(false);
  };

  // エクスポートメニューの表示切替
  const toggleExportMenu = () => {
    setShowExportMenu(!showExportMenu);
  };
  
  // テンプレートモーダルを開く
  const openTemplateModal = (template?: Template) => {
    setEditingTemplate(template || null);
    setIsTemplateModalOpen(true);
  };
  
  // テンプレートを保存する
  const handleSaveTemplate = (template: Template) => {
    saveTemplate(template);
    
    // ローカルのテンプレートリストを更新
    setTemplates(getTemplates());
    
    // 成功メッセージを表示
    setImportSuccess(`テンプレート「${template.name}」を保存しました`);
    setTimeout(() => {
      setImportSuccess(null);
    }, 3000);
  };
  
  // テンプレートの削除を確認する
  const handleDeleteTemplateClick = (e: React.MouseEvent, templateId: string) => {
    e.stopPropagation(); // テンプレート選択イベントが発火しないようにする
    setTemplateToDelete(templateId);
    setShowDeleteTemplateConfirm(true);
  };
  
  // テンプレートの削除を実行する
  const confirmDeleteTemplate = () => {
    if (templateToDelete) {
      deleteTemplate(templateToDelete);
      setTemplates(getTemplates()); // リストを更新
      setTemplateToDelete(null);
      setShowDeleteTemplateConfirm(false);
      
      // 成功メッセージを表示
      setImportSuccess('テンプレートを削除しました');
      setTimeout(() => {
        setImportSuccess(null);
      }, 3000);
    }
  };
  
  // テンプレートの削除をキャンセル
  const cancelDeleteTemplate = () => {
    setTemplateToDelete(null);
    setShowDeleteTemplateConfirm(false);
  };
  
  // テンプレートを選択する
  const handleTemplateSelect = (template: Template) => {
    if (onTemplateSelect) {
      onTemplateSelect(template);
    }
  };
  
  // テンプレートセクションの表示/非表示を切り替え
  const toggleTemplatesSection = () => {
    setShowTemplates(!showTemplates);
  };

  return (
    <div className="bg-gray-900 text-white w-64 flex flex-col h-full">
      <div className="p-4 flex items-center justify-between border-b border-gray-700">
        <div className="flex items-center">
          {/* ユーザーID表示 */}
          {userId && (
            <span className="text-xs text-gray-300 bg-gray-800 px-2 py-1 rounded">
              {userId}
            </span>
          )}
        </div>
        <div className="flex space-x-2">
          <div className="relative">
            <button
              onClick={toggleExportMenu}
              className="p-1 rounded-md hover:bg-gray-700"
              aria-label="インポート・エクスポートオプション"
              title="インポート・エクスポートオプション"
            >
              <Download size={18} />
            </button>
            
            {/* エクスポート/インポートのドロップダウンメニュー */}
            {showExportMenu && (
              <div className="absolute right-0 mt-2 w-48 rounded-md shadow-lg bg-gray-800 ring-1 ring-black ring-opacity-5 z-10">
                <div className="py-1">
                  <button
                    onClick={() => {
                      handleExportChats();
                      setShowExportMenu(false);
                    }}
                    className="w-full text-left px-4 py-2 text-sm text-gray-300 hover:bg-gray-700 flex items-center"
                  >
                    <Download size={14} className="mr-2" />
                    全チャット履歴をエクスポート
                  </button>
                  <button
                    onClick={() => {
                      handleImportClick();
                      setShowExportMenu(false);
                    }}
                    className="w-full text-left px-4 py-2 text-sm text-gray-300 hover:bg-gray-700 flex items-center"
                  >
                    <Upload size={14} className="mr-2" />
                    全チャット履歴をインポート
                  </button>
                  <button
                    onClick={() => {
                      handleSingleChatImportClick();
                      setShowExportMenu(false);
                    }}
                    className="w-full text-left px-4 py-2 text-sm text-gray-300 hover:bg-gray-700 flex items-center"
                  >
                    <Upload size={14} className="mr-2" />
                    チャットを追加インポート
                  </button>
                </div>
              </div>
            )}
          </div>
          
          <button
            onClick={handleClearAllClick}
            className="p-1 rounded-md hover:bg-gray-700"
            aria-label="すべてのデータをクリア"
            title="すべてのデータをクリア"
          >
            <RefreshCw size={18} />
          </button>
        </div>
        
        {/* 非表示のファイル入力 */}
        <input
          ref={fileInputRef}
          type="file"
          accept=".json"
          onChange={handleFileChange}
          className="hidden"
        />
        
        {/* 単一チャットインポート用のファイル入力 */}
        <input
          ref={singleChatImportInputRef}
          type="file"
          accept=".json"
          onChange={handleSingleChatFileChange}
          className="hidden"
        />
      </div>
      
      {/* インポート/エクスポートのステータスメッセージ */}
      {(importError || importSuccess) && (
        <div className={`mx-4 my-2 px-3 py-2 rounded-md text-sm ${
          importError 
            ? 'bg-red-900 text-red-200' 
            : 'bg-green-900 text-green-200'
        }`}>
          {importError || importSuccess}
        </div>
      )}
      
      <button
        onClick={onNewChat}
        className="flex items-center space-x-2 m-4 p-3 border border-gray-700 rounded-md hover:bg-gray-800"
      >
        <MessageSquarePlus size={18} />
        <span>新しいチャット</span>
      </button>
      
      {/* テンプレートセクション */}
      <div className="px-4 pt-2 pb-1">
        <div className="flex justify-between items-center">
          <button
            onClick={toggleTemplatesSection}
            className="flex items-center text-xs uppercase text-gray-400 font-semibold hover:text-gray-300"
          >
            <span>テンプレート</span>
            <span className="ml-1">{showTemplates ? '▼' : '▶'}</span>
          </button>
          <button
            onClick={() => openTemplateModal()}
            className="p-1 rounded-md hover:bg-gray-700 text-gray-400 hover:text-white"
            title="新規テンプレートを作成"
          >
            <PlusCircle size={16} />
          </button>
        </div>
        
        {/* テンプレート一覧 */}
        {showTemplates && templates.length > 0 && (
          <div className="mt-2 space-y-1 max-h-60 overflow-y-auto">
            {templates.map(template => (
              <div
                key={template.id}
                className="group relative flex items-center p-2 text-white bg-gray-800 hover:bg-gray-700 rounded-md cursor-pointer transition-colors"
                onClick={() => handleTemplateSelect(template)}
              >
                <FileCode size={14} className="mr-2 flex-shrink-0 text-blue-400" />
                <span className="truncate flex-grow">{template.name}</span>
                
                <div className="flex-shrink-0 ml-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      openTemplateModal(template);
                    }}
                    className="p-1 text-gray-300 hover:text-white"
                    title="テンプレートを編集"
                  >
                    <Edit size={12} />
                  </button>
                  <button
                    onClick={(e) => handleDeleteTemplateClick(e, template.id)}
                    className="p-1 text-gray-300 hover:text-red-400"
                    title="テンプレートを削除"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
        
        {/* テンプレートがない場合のメッセージ */}
        {showTemplates && templates.length === 0 && (
          <p className="mt-2 text-xs text-gray-500 italic">
            テンプレートがありません。「+」ボタンから作成できます。
          </p>
        )}
      </div>
      
      {/* チャット履歴 */}
      <div className="mt-2">
        <div className="px-4 py-1">
          <h3 className="text-xs uppercase text-gray-400 font-semibold">チャット履歴</h3>
        </div>
        <div className="flex-1 overflow-y-auto max-h-[30vh]">
          {chats.map((chat) => (
            <div
              key={chat.id}
              className={`flex items-center justify-between p-3 mx-2 my-1 rounded-md cursor-pointer ${
                chat.id === activeChatId ? 'bg-gray-800' : 'hover:bg-gray-800'
              }`}
              onClick={() => onChatSelect(chat.id)}
            >
              <div className="overflow-hidden whitespace-nowrap overflow-ellipsis flex-1">
                {chat.title || '新しいチャット'}
              </div>
              <div className="flex">
                <button
                  onClick={(e) => handleExportChatClick(e, chat.id)}
                  className="p-1.5 rounded hover:bg-gray-700 opacity-70 hover:opacity-100 transition-opacity"
                  aria-label="チャットをエクスポート"
                  title="チャットをエクスポート"
                >
                  <Archive size={14} />
                </button>
                <button
                  onClick={(e) => handleDeleteClick(e, chat.id)}
                  className="p-1.5 rounded hover:bg-gray-700 opacity-70 hover:opacity-100 transition-opacity"
                  aria-label="チャットを削除"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
      
      {/* 外部AIサービスリンクセクション */}
      <div className="border-t border-gray-700 p-4 mt-auto">
        <div className="flex justify-between items-center mb-2">
          <h3 className="text-xs uppercase text-gray-400 font-semibold">他のAIサービス</h3>
          <button
            onClick={handleShowAddServiceForm}
            className="p-1 rounded-md hover:bg-gray-700 text-gray-400 hover:text-white"
            aria-label="AIサービスを追加"
            title="AIサービスを追加"
          >
            <PlusCircle size={16} />
          </button>
        </div>
        
        {/* AIサービス追加フォーム */}
        {showAddServiceForm && (
          <div className="mb-4 p-3 bg-gray-800 rounded-md">
            <div className="flex justify-between items-center mb-2">
              <h4 className="text-sm font-medium">新しいサービスを追加</h4>
              <button
                onClick={() => setShowAddServiceForm(false)}
                className="p-1 rounded-full hover:bg-gray-700"
              >
                <X size={14} />
              </button>
            </div>
            <div className="space-y-2">
              <div>
                <label htmlFor="service-name" className="block text-xs text-gray-400">
                  サービス名 <span className="text-red-400">*</span>
                </label>
                <input
                  id="service-name"
                  type="text"
                  value={newServiceName}
                  onChange={(e) => setNewServiceName(e.target.value)}
                  className="w-full bg-gray-700 border border-gray-600 rounded px-2 py-1 text-sm mt-1 text-white"
                  placeholder="絵本 recraft"
                />
              </div>
              <div>
                <label htmlFor="service-url" className="block text-xs text-gray-400">
                  URL <span className="text-red-400">*</span>
                </label>
                <input
                  id="service-url"
                  type="text"
                  value={newServiceUrl}
                  onChange={(e) => setNewServiceUrl(e.target.value)}
                  className="w-full bg-gray-700 border border-gray-600 rounded px-2 py-1 text-sm mt-1 text-white"
                  placeholder="https://example.com"
                />
              </div>
              <div>
                <label htmlFor="service-description" className="block text-xs text-gray-400">
                  説明 (任意)
                </label>
                <input
                  id="service-description"
                  type="text"
                  value={newServiceDescription}
                  onChange={(e) => setNewServiceDescription(e.target.value)}
                  className="w-full bg-gray-700 border border-gray-600 rounded px-2 py-1 text-sm mt-1 text-white"
                  placeholder="このサービスの説明"
                />
              </div>
              <button
                onClick={handleAddService}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded text-sm mt-2"
              >
                追加
              </button>
            </div>
          </div>
        )}
        
        {/* AIサービス一覧 */}
        {aiServices.map((service) => (
          <div
            key={service.id}
            className="group relative"
          >
            <a 
              href={service.url} 
              target="_blank" 
              rel="noopener noreferrer"
              className="flex items-center p-2 text-gray-300 hover:text-white hover:bg-gray-800 rounded-md transition-colors"
              title={service.description}
            >
              <ExternalLink size={16} className="mr-2" />
              <span>{service.name}</span>
            </a>
            <button
              onClick={() => handleDeleteServiceClick(service.id)}
              className="absolute right-2 top-1/2 transform -translate-y-1/2 p-1 rounded-full hover:bg-gray-700 text-gray-400 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
              aria-label={`${service.name}を削除`}
              title={`${service.name}を削除`}
            >
              <Trash2 size={14} />
            </button>
          </div>
        ))}
      </div>
      
      {/* ログアウトボタン */}
      <div className="border-t border-gray-700 p-4">
        <button
          onClick={handleLogoutClick}
          className="flex items-center w-full p-2 text-gray-300 hover:text-white hover:bg-gray-800 rounded-md transition-colors"
        >
          <LogOut size={16} className="mr-2" />
          <span>ログアウト</span>
        </button>
      </div>

      {/* 削除確認モーダル */}
      {showDeleteConfirm && (
        <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-gray-800 p-4 rounded-lg shadow-lg max-w-xs w-full">
            <div className="flex items-center text-yellow-400 mb-3">
              <AlertTriangle size={20} className="mr-2" />
              <h3 className="font-medium">チャットを削除しますか？</h3>
            </div>
            <p className="text-sm text-gray-300 mb-4">
              この操作は取り消せません。このチャットと全てのメッセージが完全に削除されます。
            </p>
            <div className="flex justify-end space-x-2">
              <button
                onClick={cancelDelete}
                className="px-3 py-1.5 bg-gray-700 text-white rounded hover:bg-gray-600"
              >
                キャンセル
              </button>
              <button
                onClick={confirmDelete}
                className="px-3 py-1.5 bg-red-600 text-white rounded hover:bg-red-700"
              >
                削除する
              </button>
            </div>
          </div>
        </div>
      )}

      {/* すべてのデータを削除する確認モーダル */}
      {showClearAllConfirm && (
        <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-gray-800 p-4 rounded-lg shadow-lg max-w-xs w-full">
            <div className="flex items-center text-yellow-400 mb-3">
              <AlertTriangle size={20} className="mr-2" />
              <h3 className="font-medium">すべての履歴を削除しますか？</h3>
            </div>
            <p className="text-sm text-gray-300 mb-4">
              この操作は取り消せません。すべてのチャット履歴が完全に削除されます。
            </p>
            <div className="flex justify-end space-x-2">
              <button
                onClick={cancelClearAll}
                className="px-3 py-1.5 bg-gray-700 text-white rounded hover:bg-gray-600"
              >
                キャンセル
              </button>
              <button
                onClick={confirmClearAll}
                className="px-3 py-1.5 bg-red-600 text-white rounded hover:bg-red-700"
              >
                削除する
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* ログアウト確認モーダル */}
      {showLogoutConfirm && (
        <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-gray-800 p-4 rounded-lg shadow-lg max-w-xs w-full">
            <div className="flex items-center text-yellow-400 mb-3">
              <AlertTriangle size={20} className="mr-2" />
              <h3 className="font-medium">ログアウトしますか？</h3>
            </div>
            <p className="text-sm text-gray-300 mb-4">
              ログアウトすると、再度ログインするまでアプリにアクセスできなくなります。
            </p>
            <div className="flex justify-end space-x-2">
              <button
                onClick={cancelLogout}
                className="px-3 py-1.5 bg-gray-700 text-white rounded hover:bg-gray-600"
              >
                キャンセル
              </button>
              <button
                onClick={confirmLogout}
                className="px-3 py-1.5 bg-red-600 text-white rounded hover:bg-red-700"
              >
                ログアウト
              </button>
            </div>
          </div>
        </div>
      )}

      {/* AIサービス削除確認モーダル */}
      {showDeleteServiceConfirm && (
        <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-gray-800 p-4 rounded-lg shadow-lg max-w-xs w-full">
            <div className="flex items-center text-yellow-400 mb-3">
              <AlertTriangle size={20} className="mr-2" />
              <h3 className="font-medium">AIサービスを削除しますか？</h3>
            </div>
            <p className="text-sm text-gray-300 mb-4">
              このサービスをリストから削除します。
            </p>
            <div className="flex justify-end space-x-2">
              <button
                onClick={cancelDeleteService}
                className="px-3 py-1.5 bg-gray-700 text-white rounded hover:bg-gray-600"
              >
                キャンセル
              </button>
              <button
                onClick={confirmDeleteService}
                className="px-3 py-1.5 bg-red-600 text-white rounded hover:bg-red-700"
              >
                削除する
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* テンプレート削除確認モーダル */}
      {showDeleteTemplateConfirm && (
        <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-gray-800 p-4 rounded-lg shadow-lg max-w-xs w-full">
            <div className="flex items-center text-yellow-400 mb-3">
              <AlertTriangle size={20} className="mr-2" />
              <h3 className="font-medium">テンプレートを削除しますか？</h3>
            </div>
            <p className="text-sm text-gray-300 mb-4">
              このテンプレートを削除します。この操作は取り消せません。
            </p>
            <div className="flex justify-end space-x-2">
              <button
                onClick={cancelDeleteTemplate}
                className="px-3 py-1.5 bg-gray-700 text-white rounded hover:bg-gray-600"
              >
                キャンセル
              </button>
              <button
                onClick={confirmDeleteTemplate}
                className="px-3 py-1.5 bg-red-600 text-white rounded hover:bg-red-700"
              >
                削除する
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* テンプレート作成/編集モーダル */}
      <TemplateModal
        isOpen={isTemplateModalOpen}
        onClose={() => setIsTemplateModalOpen(false)}
        template={editingTemplate}
        onSave={handleSaveTemplate}
      />
    </div>
  );
};

export default Sidebar;