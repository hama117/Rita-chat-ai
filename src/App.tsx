import React, { useState, useEffect, useRef } from 'react';
import { Settings as SettingsIcon } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import Sidebar from './components/Sidebar';
import ChatMessage from './components/ChatMessage';
import ChatInput from './components/ChatInput';
import SettingsModal from './components/SettingsModal';
import EmptyState from './components/EmptyState';
import Login from './components/Login';
import { Message, Chat, Settings, PDFDocument, Template } from './types';
import { sendMessageToOpenAI, DEFAULT_MODEL } from './services/openai';
import { exportTableToExcel, revokeExcelUrl } from './utils/exportUtils';
import {
  getSettings,
  saveSettings,
  getChats,
  saveChat,
  deleteChat,
  getActiveChatId,
  clearAllData,
  getModelDisplayName,
} from './utils/storage';
import { getPdfSummaryForPrompt } from './utils/pdfUtils';
import { isLoggedIn, saveLoggedInUser, logout, refreshLoginSession } from './utils/authUtils';

function App() {
  const [settings, setSettings] = useState<Settings>({ apiKey: '', model: DEFAULT_MODEL });
  const [chats, setChats] = useState<Chat[]>([]);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isMobile, setIsMobile] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isExporting, setIsExporting] = useState(false);
  const [excelDownloadUrl, setExcelDownloadUrl] = useState<string | null>(null);
  const [downloadFileName, setDownloadFileName] = useState<string>('');
  const [showDownloadModal, setShowDownloadModal] = useState(false);
  const [isLoggedInUser, setIsLoggedInUser] = useState<boolean>(false);
  const [userId, setUserId] = useState<string>('');
  const [currentTemplate, setCurrentTemplate] = useState<Template | null>(null);
  const [inputPrompt, setInputPrompt] = useState<string>('');
  const [waitingForFollowUp, setWaitingForFollowUp] = useState<boolean>(false);
  const mainContentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const loggedIn = isLoggedIn();
    setIsLoggedInUser(loggedIn);
  }, []);

  const handleLoginSuccess = (loggedInUserId: string, token: string, exp: number) => {
    setUserId(loggedInUserId);
    setIsLoggedInUser(true);
    saveLoggedInUser(loggedInUserId, token, exp);
  };

  const handleLogout = () => {
    logout();
    setIsLoggedInUser(false);
    setUserId('');
  };

  useEffect(() => {
    const checkDevice = () => {
      const userAgent = navigator.userAgent || navigator.vendor || (window as any).opera;
      const isMobileDevice = /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(userAgent.toLowerCase());
      setIsMobile(isMobileDevice || window.innerWidth < 768);
      setIsSidebarOpen(!(isMobileDevice || window.innerWidth < 768));
    };
    checkDevice();
    window.addEventListener('resize', checkDevice);
    return () => window.removeEventListener('resize', checkDevice);
  }, []);

  useEffect(() => {
    if (isLoggedInUser) {
      const storedChats = getChats();
      const storedActiveChatId = getActiveChatId();
      const resetChats = storedChats.map(chat => ({
        ...chat,
        messages: chat.messages.map(msg => ({ ...msg, isNew: false }))
      }));
      setChats(resetChats);
      setActiveChatId(storedActiveChatId);
      setSettings({ ...getSettings(), apiKey: '', model: DEFAULT_MODEL });
      refreshLoginSession();
    }
  }, [isLoggedInUser]);

  useEffect(() => {
    return () => {
      if (excelDownloadUrl) revokeExcelUrl(excelDownloadUrl);
    };
  }, [excelDownloadUrl]);

  const activeChat = activeChatId ? chats.find((chat) => chat.id === activeChatId) || null : null;

  const createNewChat = () => {
    const newChat: Chat = {
      id: uuidv4(),
      title: '新しいチャット',
      messages: [],
      createdAt: Date.now(),
    };
    setChats((prevChats) => [newChat, ...prevChats]);
    setActiveChatId(newChat.id);
    saveChat(newChat);
    if (isMobile) setIsSidebarOpen(false);
    return newChat;
  };

  const handleSendMessage = async (content: string, images?: string[], pdfs?: PDFDocument[]) => {
    setError(null);

    let currentChat = activeChat;
    if (!currentChat) currentChat = createNewChat();

    let messageContent = content;
    if (pdfs && pdfs.length > 0) {
      const pdfInfo = pdfs.map((pdf, index) => {
        const pdfSummary = getPdfSummaryForPrompt(pdf);
        return `[PDF ${index + 1}: ${pdf.name} (${pdf.pageCount}ページ)]\n${pdfSummary}`;
      }).join('\n\n');
      if (!messageContent.trim()) messageContent = 'このPDFの内容を分析して、要点をまとめてください。';
      messageContent = `${messageContent}\n\n添付PDF情報:\n${pdfInfo}`;
    }

    const userMessage: Message = {
      id: uuidv4(),
      role: 'user',
      content: messageContent,
      timestamp: Date.now(),
      images,
      pdfs
    };

    const updatedMessages = [...currentChat.messages, userMessage];
    const updatedChat: Chat = {
      ...currentChat,
      messages: updatedMessages,
      title: currentChat.messages.length === 0
        ? (content ? content.slice(0, 30) : pdfs && pdfs.length > 0 ? `${pdfs[0].name}の分析` : '画像付きチャット')
        : currentChat.title,
    };

    setChats((prevChats) => prevChats.map((chat) => (chat.id === updatedChat.id ? updatedChat : chat)));
    saveChat(updatedChat);

    setTimeout(() => {
      if (mainContentRef.current) mainContentRef.current.scrollTop = mainContentRef.current.scrollHeight;
    }, 100);

    if (currentTemplate && currentTemplate.followUpPrompt) {
      setWaitingForFollowUp(true);
    } else {
      setCurrentTemplate(null);
    }
    setInputPrompt('');

    setIsLoading(true);
    try {
      const aiResponse = await sendMessageToOpenAI('', updatedMessages, DEFAULT_MODEL);

      const aiMessage: Message = {
        id: uuidv4(),
        role: 'assistant',
        content: aiResponse,
        timestamp: Date.now(),
        isNew: true
      };

      const chatWithAiResponse: Chat = {
        ...updatedChat,
        messages: [...updatedMessages, aiMessage],
      };

      setChats((prevChats) => prevChats.map((chat) => (chat.id === chatWithAiResponse.id ? chatWithAiResponse : chat)));
      saveChat(chatWithAiResponse);
      refreshLoginSession();

      setTimeout(() => {
        if (mainContentRef.current) mainContentRef.current.scrollTop = mainContentRef.current.scrollHeight;
      }, 100);

      if (waitingForFollowUp && currentTemplate && currentTemplate.followUpPrompt) {
        setInputPrompt(currentTemplate.followUpPrompt);
        setWaitingForFollowUp(false);
      } else {
        setCurrentTemplate(null);
      }
    } catch (error) {
      console.error('Error getting OpenAI response:', error);
      setError(error instanceof Error ? error.message : 'AIからの応答取得中にエラーが発生しました');
      setWaitingForFollowUp(false);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelectChat = (chatId: string) => {
    setActiveChatId(chatId);
    setChats(prevChats =>
      prevChats.map(chat => chat.id === chatId
        ? { ...chat, messages: chat.messages.map(msg => ({ ...msg, isNew: false })) }
        : chat
      )
    );
    if (isMobile) setIsSidebarOpen(false);
    refreshLoginSession();
  };

  const handleDeleteChat = (chatId: string) => {
    deleteChat(chatId);
    setChats((prevChats) => prevChats.filter((chat) => chat.id !== chatId));
    if (activeChatId === chatId) {
      const remainingChats = chats.filter((chat) => chat.id !== chatId);
      setActiveChatId(remainingChats.length > 0 ? remainingChats[0].id : null);
    }
    refreshLoginSession();
  };

  const handleSaveSettings = (newSettings: Settings) => {
    newSettings.model = DEFAULT_MODEL;
    setSettings(newSettings);
    saveSettings({ ...newSettings, apiKey: '' });
    refreshLoginSession();
  };

  const handleClearAllData = () => {
    clearAllData();
    setChats([]);
    setActiveChatId(null);
    refreshLoginSession();
  };

  const toggleSidebar = () => setIsSidebarOpen(!isSidebarOpen);

  const handleExportTableToExcel = async (message: Message) => {
    setIsExporting(true);
    setError(null);
    try {
      if (excelDownloadUrl) {
        revokeExcelUrl(excelDownloadUrl);
        setExcelDownloadUrl(null);
      }
      const url = await exportTableToExcel(message);
      if (!url) {
        setError('エクスポートできる表形式のデータが見つかりませんでした。');
        return;
      }
      setExcelDownloadUrl(url);
      setDownloadFileName(`表データ_${new Date().toISOString().split('T')[0]}.xlsx`);
      setShowDownloadModal(true);
      refreshLoginSession();
    } catch (error) {
      setError('テーブルのExcelへのエクスポートに失敗しました。');
    } finally {
      setIsExporting(false);
    }
  };

  const handleTemplateSelect = (template: Template) => {
    setCurrentTemplate(template);
    setInputPrompt(template.initialPrompt);
    if (isMobile) setIsSidebarOpen(false);
  };

  const ThinkingAnimation = () => {
    const [dots, setDots] = useState('');
    useEffect(() => {
      const interval = setInterval(() => {
        setDots(prev => prev === '...' ? '' : prev + '.');
      }, 500);
      return () => clearInterval(interval);
    }, []);
    return (
      <div className="flex items-center">
        <span className="font-medium text-blue-500">Thinking</span>
        <span className="w-8 inline-block text-blue-500">{dots}</span>
      </div>
    );
  };

  if (!isLoggedInUser) {
    return <Login onLoginSuccess={handleLoginSuccess} />;
  }

  return (
    <div className="flex h-screen bg-white">
      {isMobile && isSidebarOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-30" onClick={toggleSidebar} />
      )}

      <div className={`${isSidebarOpen ? 'block' : 'hidden'} ${isMobile ? 'fixed z-40 h-full w-64 shadow-lg' : 'w-64'}`}>
        <Sidebar
          chats={chats}
          activeChatId={activeChatId}
          onChatSelect={handleSelectChat}
          onNewChat={createNewChat}
          onDeleteChat={handleDeleteChat}
          onOpenSettings={() => setIsSettingsOpen(true)}
          onClearAllData={handleClearAllData}
          onLogout={handleLogout}
          onTemplateSelect={handleTemplateSelect}
          userId={userId}
        />
      </div>

      <div className="flex-1 flex flex-col h-full overflow-hidden">
        <div className="bg-gray-50 border-b border-gray-200 py-1 px-3">
          <p className="text-[10px] text-gray-500 text-center">
            履歴はブラウザストレージに保存していますので別のPCや別のブラウザでは表示できません。
          </p>
        </div>

        <header className="border-b border-gray-200 bg-white p-3 flex justify-between items-center shadow-sm">
          <div className="flex items-center">
            <button onClick={toggleSidebar} className="p-2 rounded-md text-gray-500 hover:bg-gray-100 mr-2">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            <span className="text-[10px] text-gray-700 bg-gray-100 px-1.5 py-0.5 rounded mr-3">
              {getModelDisplayName(DEFAULT_MODEL)}
            </span>
            <h1 className="text-lg font-semibold truncate max-w-[140px] sm:max-w-none">
              {activeChat ? activeChat.title : 'Rita-chat-ai'}
            </h1>
          </div>

          <div className="flex items-center space-x-2">
            {userId && (
              <span className="text-xs text-gray-600 bg-gray-100 px-2 py-1 rounded">{userId}</span>
            )}
            <button onClick={() => setIsSettingsOpen(true)} className="p-2 rounded-full hover:bg-gray-100">
              <SettingsIcon size={20} />
            </button>
          </div>
        </header>

        <main ref={mainContentRef} className="flex-1 overflow-y-auto bg-white pb-16 no-bounce">
          {!activeChat ? (
            <EmptyState hasApiKey={true} onOpenSettings={() => setIsSettingsOpen(true)} />
          ) : (
            <>
              {activeChat.messages.length === 0 ? (
                <EmptyState hasApiKey={true} onOpenSettings={() => setIsSettingsOpen(true)} />
              ) : (
                <div>
                  {activeChat.messages.map((message) => (
                    <ChatMessage
                      key={message.id}
                      message={message}
                      onExportTableToExcel={message.role === 'assistant' ? handleExportTableToExcel : undefined}
                    />
                  ))}
                  {isLoading && (
                    <div className="py-5 bg-white border-b">
                      <div className="max-w-3xl mx-auto px-4">
                        <div className="flex items-start">
                          <div className="flex-shrink-0 w-8 h-8 rounded-full bg-green-500 flex items-center justify-center">
                            <span className="text-white text-sm">AI</span>
                          </div>
                          <div className="ml-4 flex-1">
                            <div className="text-sm font-medium">OpenAI</div>
                            <div className="mt-2 text-sm"><ThinkingAnimation /></div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
              {error && (
                <div className="py-4 px-6 bg-red-50 border-l-4 border-red-500 my-4 mx-auto max-w-3xl">
                  <p className="text-red-700">{error}</p>
                </div>
              )}
            </>
          )}
        </main>

        <div className="w-full bottom-0 left-0 right-0 bg-white z-10">
          <ChatInput
            onSendMessage={handleSendMessage}
            disabled={isLoading}
            initialValue={inputPrompt}
            onInputChange={(value) => setInputPrompt(value)}
          />
        </div>
      </div>

      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        settings={settings}
        onSave={handleSaveSettings}
      />

      {showDownloadModal && excelDownloadUrl && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center">
          <div className="bg-white rounded-lg shadow-lg max-w-md w-full p-6">
            <h3 className="text-lg font-semibold mb-4">Excel ファイルのダウンロード</h3>
            <p className="mb-6 text-sm text-gray-600">表データを Excel 形式で出力しました。</p>
            <div className="mb-6 border rounded-md p-4 bg-gray-50">
              <a href={excelDownloadUrl} download={downloadFileName}
                className="text-blue-600 hover:text-blue-800 underline flex items-center"
                onClick={() => setShowDownloadModal(false)}>
                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                {downloadFileName}
              </a>
            </div>
            <div className="flex justify-end">
              <button onClick={() => setShowDownloadModal(false)}
                className="px-4 py-2 bg-gray-200 text-gray-800 rounded hover:bg-gray-300">
                閉じる
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
