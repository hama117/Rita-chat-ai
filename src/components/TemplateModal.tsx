import React, { useState, useEffect } from 'react';
import { X, Save, AlertCircle } from 'lucide-react';
import { Template } from '../types';
import { v4 as uuidv4 } from 'uuid';

interface TemplateModalProps {
  isOpen: boolean;
  onClose: () => void;
  template?: Template | null; // 編集時は既存のテンプレートを渡す
  onSave: (template: Template) => void;
}

const TemplateModal: React.FC<TemplateModalProps> = ({ 
  isOpen, 
  onClose, 
  template,
  onSave 
}) => {
  const [name, setName] = useState('');
  const [initialPrompt, setInitialPrompt] = useState('');
  const [followUpPrompt, setFollowUpPrompt] = useState('');
  const [instructions, setInstructions] = useState('');
  const [error, setError] = useState<string | null>(null);
  
  // テンプレートが渡された場合はフォームに値をセット
  useEffect(() => {
    if (template) {
      setName(template.name);
      setInitialPrompt(template.initialPrompt);
      setFollowUpPrompt(template.followUpPrompt);
      setInstructions(template.instructions);
    } else {
      // 新規作成時は初期化
      setName('');
      setInitialPrompt('');
      setFollowUpPrompt('');
      setInstructions('');
    }
    // エラーもリセット
    setError(null);
  }, [template, isOpen]);

  const handleSave = () => {
    // 必須項目のバリデーション
    if (!name.trim()) {
      setError('テンプレート名は必須です');
      return;
    }
    
    // 初期プロンプトは必須
    if (!initialPrompt.trim()) {
      setError('初期プロンプトは必須です');
      return;
    }
    
    // テンプレートオブジェクトを作成
    const templateData: Template = {
      id: template?.id || uuidv4(), // 既存のIDを使用するか、新規IDを生成
      name: name.trim(),
      initialPrompt: initialPrompt.trim(),
      followUpPrompt: followUpPrompt.trim(),
      instructions: instructions.trim(),
      createdAt: template?.createdAt || Date.now(), // 既存の作成日時を使用するか、現在時刻を設定
    };
    
    // 保存処理
    onSave(templateData);
    onClose();
  };

  // モーダルが非表示の場合は何もレンダリングしない
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-white rounded-lg w-full max-w-xl mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center p-4 border-b">
          <h2 className="text-xl font-semibold text-gray-800">
            {template ? 'テンプレートを編集' : '新しいテンプレート'}
          </h2>
          <button
            onClick={onClose}
            className="p-1 rounded-full hover:bg-gray-100 text-gray-600"
          >
            <X size={20} />
          </button>
        </div>
        
        <div className="p-4">
          {error && (
            <div className="mb-4 flex items-center p-3 bg-red-50 text-red-700 rounded-md">
              <AlertCircle size={18} className="mr-2" />
              <span>{error}</span>
            </div>
          )}
          
          <div className="space-y-4">
            <div>
              <label htmlFor="template-name" className="block text-sm font-medium text-gray-700 mb-1">
                テンプレート名 <span className="text-red-500">*</span>
              </label>
              <input
                id="template-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-800"
                placeholder="例: 数学の問題を解く"
              />
            </div>
            
            <div>
              <label htmlFor="initial-prompt" className="block text-sm font-medium text-gray-700 mb-1">
                初期プロンプト <span className="text-red-500">*</span>
                <span className="text-xs text-gray-500 ml-1">(テンプレート選択時に自動入力されます)</span>
              </label>
              <textarea
                id="initial-prompt"
                value={initialPrompt}
                onChange={(e) => setInitialPrompt(e.target.value)}
                rows={4}
                className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-800"
                placeholder="例: 次の数学の問題を解いてください: "
              />
            </div>
            
            <div>
              <label htmlFor="follow-up-prompt" className="block text-sm font-medium text-gray-700 mb-1">
                フォローアッププロンプト
                <span className="text-xs text-gray-500 ml-1">(ユーザーが応答した後に自動入力されます)</span>
              </label>
              <textarea
                id="follow-up-prompt"
                value={followUpPrompt}
                onChange={(e) => setFollowUpPrompt(e.target.value)}
                rows={3}
                className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-800"
                placeholder="例: この問題の解き方を詳しく説明してください。"
              />
            </div>
            
            <div>
              <label htmlFor="instructions" className="block text-sm font-medium text-gray-700 mb-1">
                詳細な手順/ガイドライン
                <span className="text-xs text-gray-500 ml-1">(AIの対応方法を指定するインストラクション)</span>
              </label>
              <textarea
                id="instructions"
                value={instructions}
                onChange={(e) => setInstructions(e.target.value)}
                rows={5}
                className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-800"
                placeholder="例: 数式はLaTeX形式で表示し、解き方を段階的に説明してください。また、類似問題も提供してください。"
              />
            </div>
          </div>
        </div>
        
        <div className="flex justify-end p-4 border-t">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-md mr-2"
          >
            キャンセル
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 flex items-center"
          >
            <Save size={16} className="mr-2" />
            保存
          </button>
        </div>
      </div>
    </div>
  );
};

export default TemplateModal;