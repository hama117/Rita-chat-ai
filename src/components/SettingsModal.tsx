import React from 'react';
import { X, Check } from 'lucide-react';
import { Settings } from '../types';
import { DEFAULT_MODEL, getModelDisplayName } from '../services/openai';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: Settings;
  onSave: (settings: Settings) => void;
}

const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose, onSave }) => {
  const handleSave = () => {
    onSave({ apiKey: '', model: DEFAULT_MODEL });
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-white rounded-lg w-full max-w-md mx-4">
        <div className="flex justify-between items-center p-4 border-b">
          <h2 className="text-xl font-semibold">設定</h2>
          <button onClick={onClose} className="p-1 rounded-full hover:bg-gray-100">
            <X size={20} />
          </button>
        </div>

        <div className="p-4">
          <div className="mb-4">
            <div className="bg-green-50 p-3 rounded-md flex items-center">
              <Check size={16} className="text-green-600 mr-2" />
              <p className="text-sm text-green-700">
                APIキーはサーバーで安全に管理されています
              </p>
            </div>
          </div>

          <div className="mb-4">
            <div className="bg-gray-50 p-3 rounded-md">
              <div className="flex items-center">
                <input
                  id="model-default"
                  type="radio"
                  name="model"
                  checked={true}
                  className="h-5 w-5 text-blue-600"
                  readOnly
                />
                <label htmlFor="model-default" className="ml-3 block text-sm font-medium text-gray-700">
                  {getModelDisplayName(DEFAULT_MODEL)}
                </label>
              </div>
            </div>
          </div>
        </div>

        <div className="flex justify-end p-4 border-t">
          <button onClick={onClose} className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-md mr-2">
            キャンセル
          </button>
          <button onClick={handleSave} className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600">
            保存
          </button>
        </div>
      </div>
    </div>
  );
};

export default SettingsModal;