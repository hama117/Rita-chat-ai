import React from 'react';
import { Settings, RefreshCw } from 'lucide-react';

interface EmptyStateProps {
  hasApiKey: boolean;
  onOpenSettings: () => void;
}

const EmptyState: React.FC<EmptyStateProps> = ({ hasApiKey, onOpenSettings }) => {
  return (
    <div className="flex flex-col items-center justify-center h-full p-4">
      <div className="max-w-md text-center px-4">
        <h2 className="text-xl sm:text-2xl font-bold mb-4">
          {hasApiKey
            ? '新しい会話を始めましょう'
            : 'Rita-chat-ai へようこそ'}
        </h2>
        
        {hasApiKey ? (
          <p className="text-xs text-gray-600 mb-4">
            回答は必ずしも正しいとは限りません。重要な情報は確認するようにしてください。
          </p>
        ) : (
          <>
            <p className="text-gray-600 mb-4">
              APIキーを自動的に取得しています。少々お待ちください。
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <button
                onClick={onOpenSettings}
                className="flex items-center justify-center space-x-2 px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600"
              >
                <Settings size={18} />
                <span>設定を開く</span>
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default EmptyState;