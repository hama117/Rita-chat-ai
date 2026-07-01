import React, { useState, useRef, useEffect } from 'react';
import { Send, Image as ImageIcon, X, Camera, FileText } from 'lucide-react';
import { processPdfFile, preparePdfForUpload } from '../utils/pdfUtils';
import { PDFDocument } from '../types';

interface ChatInputProps {
  onSendMessage: (message: string, images?: string[], pdfs?: PDFDocument[]) => void;
  disabled: boolean;
  initialValue?: string; // 初期値（テンプレートなどから設定）
  onInputChange?: (value: string) => void; // 入力値の変更通知
}

const ChatInput: React.FC<ChatInputProps> = ({ 
  onSendMessage, 
  disabled, 
  initialValue = '',
  onInputChange
}) => {
  const [input, setInput] = useState('');
  const [image, setImage] = useState<string | null>(null); // 単一画像として変更
  const [pdf, setPdf] = useState<PDFDocument | null>(null); // 単一PDFとして変更
  const [isMobile, setIsMobile] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isProcessingFile, setIsProcessingFile] = useState(false);
  const [processingStatus, setProcessingStatus] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pdfInputRef = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  
  // 文字数制限を定義
  const MAX_CHARS = 4000;
  const isExceedingLimit = input.length > MAX_CHARS;

  // 初期値が設定された場合に入力欄に反映
  useEffect(() => {
    if (initialValue) {
      setInput(initialValue);
      
      // テキストエリアの高さを調整
      setTimeout(() => {
        if (textareaRef.current) {
          textareaRef.current.style.height = 'auto';
          textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`;
        }
      }, 0);
    }
  }, [initialValue]);

  // モバイルデバイスとiOSの検出
  useEffect(() => {
    const checkDevice = () => {
      const userAgent = navigator.userAgent || navigator.vendor || (window as any).opera;
      const isMobileDevice = /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(userAgent.toLowerCase());
      const isIOSDevice = /iPad|iPhone|iPod/.test(userAgent) || 
                         (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
      
      setIsMobile(isMobileDevice || window.innerWidth < 768);
      setIsIOS(isIOSDevice);
    };
    
    checkDevice();
    
    const handleResize = () => {
      checkDevice();
    };
    
    window.addEventListener('resize', handleResize);
    
    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  const sendMessage = () => {
    const trimmedInput = input.trim();
    
    // ファイル処理中は送信しない
    if (isProcessingFile) {
      return;
    }
    
    // 文字数制限をチェック
    if (isExceedingLimit) {
      return;
    }
    
    if ((trimmedInput || image || pdf) && !disabled) {
      console.log('送信内容:', { 
        text: trimmedInput, 
        hasImage: !!image,
        hasPdf: !!pdf
      });
      
      // 送信処理
      onSendMessage(
        trimmedInput, 
        image ? [image] : undefined, // 単一画像を配列として送信
        pdf ? [pdf] : undefined // 単一PDFを配列として送信
      );
      
      // 状態をリセット
      setInput('');
      setImage(null); // 画像をクリア
      setPdf(null); // PDFをクリア
      
      // 親コンポーネントに入力変更を通知
      if (onInputChange) {
        onInputChange('');
      }
      
      // 送信後にテキストエリアの高さをリセット
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
      }
    }
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage();
  };

  // Enterキーでの送信を無効化（送信ボタンのみで送信）
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // この関数でEnterキーイベントを捕捉するが、送信処理は行わない
    // Shift+Enterなどの改行は通常通り機能する
  };

  // 改善版のペースト処理: テキストと画像を適切に区別
  const handlePaste = (e: React.ClipboardEvent) => {
    if (!e.clipboardData) return;
    
    // テキスト優先モードを判定する
    // テキストコンテンツにフォーカスがある場合や、選択範囲がある場合はテキスト処理優先
    const hasTextFocus = document.activeElement === textareaRef.current;
    const hasTextSelection = window.getSelection()?.toString().length !== 0;
    const isTextEditMode = hasTextFocus || hasTextSelection;
    
    // クリップボードの内容を確認
    const hasText = e.clipboardData.types.includes('text/plain');
    const hasImage = Array.from(e.clipboardData.items).some(item => item.type.startsWith('image/'));
    const hasPdf = Array.from(e.clipboardData.items).some(item => item.type === 'application/pdf');
    
    console.log('ペースト情報:', { 
      hasTextFocus, 
      hasTextSelection, 
      hasText, 
      hasImage, 
      hasPdf 
    });
    
    // テキスト優先モードの場合、またはテキストのみの場合は
    // デフォルトの処理に任せてテキストをペースト
    if ((isTextEditMode && hasText) || (hasText && !hasImage && !hasPdf)) {
      // 通常のテキストペーストは標準の動作に任せる
      console.log('テキストのペーストを実行 (標準動作)');
      return;
    }
    
    // ここから画像やPDFの処理
    // テキスト優先モードでない場合だけ特殊メディア処理を実行
    const items = e.clipboardData.items;
    let mediaHandled = false;
    
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      
      // 画像の処理
      if (item.type.indexOf('image') !== -1) {
        // すでに画像がある場合はユーザーに通知
        if (image) {
          alert('画像は1枚までしかアップロードできません。既存の画像を削除してから再試行してください。');
          mediaHandled = true;
          break;
        }
        
        const file = item.getAsFile();
        if (file) {
          console.log('画像として処理:', file.name, file.type);
          processImageFile(file);
          mediaHandled = true;
          break;
        }
      }
      // PDFの処理
      else if (item.type === 'application/pdf') {
        // すでにPDFがある場合はユーザーに通知
        if (pdf) {
          alert('PDFは1つまでしかアップロードできません。既存のPDFを削除してから再試行してください。');
          mediaHandled = true;
          break;
        }
        
        const file = item.getAsFile();
        if (file) {
          console.log('PDFとして処理:', file.name);
          handlePdfFile(file);
          mediaHandled = true;
          break;
        }
      }
    }
    
    // メディアが処理された場合はデフォルトの貼り付け処理をキャンセル
    if (mediaHandled) {
      e.preventDefault();
    }
  };

  // 画像をリサイズして圧縮する関数
  const resizeAndCompressImage = async (file: File, maxSizeMB: number, maxDimension: number = 1600): Promise<string> => {
    return new Promise((resolve, reject) => {
      setProcessingStatus('画像の準備中...');
      
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          setProcessingStatus('画像をリサイズ中...');
          
          // Calculate new dimensions while maintaining aspect ratio
          let width = img.width;
          let height = img.height;
          
          if (width > maxDimension || height > maxDimension) {
            if (width > height) {
              height = Math.round((height * maxDimension) / width);
              width = maxDimension;
            } else {
              width = Math.round((width * maxDimension) / height);
              height = maxDimension;
            }
          }
          
          // Create canvas and resize image
          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            reject(new Error('キャンバスコンテキストを取得できませんでした'));
            return;
          }
          
          // Draw image on canvas
          ctx.drawImage(img, 0, 0, width, height);
          
          // Start with high quality
          setProcessingStatus('画像を圧縮中...');
          let quality = 0.9;
          let result = canvas.toDataURL('image/jpeg', quality);
          let resultSize = Math.ceil((result.length * 3) / 4);
          
          // Compress further if needed
          const maxSize = maxSizeMB * 1024 * 1024;
          
          // If the initial compression isn't enough, reduce quality until file size is acceptable
          const compressMore = () => {
            if (resultSize > maxSize && quality > 0.1) {
              // Reduce quality by 0.1 each step, but not below 0.1
              quality = Math.max(0.1, quality - 0.1);
              setProcessingStatus(`画像サイズが大きいため圧縮中... (${(resultSize / (1024 * 1024)).toFixed(1)}MB)`);
              
              result = canvas.toDataURL('image/jpeg', quality);
              resultSize = Math.ceil((result.length * 3) / 4);
              
              // Continue reducing if needed
              if (resultSize > maxSize && quality > 0.1) {
                setTimeout(compressMore, 0); // Use setTimeout to avoid blocking UI
              } else {
                const finalSizeMB = (resultSize / (1024 * 1024)).toFixed(1);
                console.log(`圧縮完了: ${finalSizeMB}MB, 品質: ${quality.toFixed(1)}`);
                setProcessingStatus('');
                resolve(result);
              }
            } else {
              const finalSizeMB = (resultSize / (1024 * 1024)).toFixed(1);
              console.log(`圧縮完了: ${finalSizeMB}MB, 品質: ${quality.toFixed(1)}`);
              setProcessingStatus('');
              resolve(result);
            }
          };
          
          // Start compression if needed
          if (resultSize > maxSize) {
            compressMore();
          } else {
            console.log(`圧縮不要: ${(resultSize / (1024 * 1024)).toFixed(1)}MB`);
            setProcessingStatus('');
            resolve(result);
          }
        };
        
        img.onerror = () => {
          setProcessingStatus('');
          reject(new Error('画像の読み込みに失敗しました'));
        };
        
        img.src = e.target?.result as string;
      };
      
      reader.onerror = () => {
        setProcessingStatus('');
        reject(new Error('ファイルの読み込みに失敗しました'));
      };
      
      reader.readAsDataURL(file);
    });
  };

  const processImageFile = async (file: File, maxSizeMB = 5) => {
    // すでに画像がある場合は処理しない
    if (image) {
      alert('画像は1枚までしかアップロードできません。既存の画像を削除してから再試行してください。');
      return;
    }
    
    // ファイル処理中フラグをオン
    setIsProcessingFile(true);
    
    try {
      const maxSize = maxSizeMB * 1024 * 1024; // Convert to bytes
      const fileSize = file.size;
      
      console.log('画像処理開始:', { 
        fileName: file.name, 
        fileSize: `${(fileSize / (1024 * 1024)).toFixed(2)}MB`, 
        fileType: file.type 
      });
      
      let imageData: string;
      
      // Check if the image needs to be resized/compressed
      if (fileSize > maxSize) {
        console.log(`画像サイズが大きいため圧縮します: ${(fileSize / (1024 * 1024)).toFixed(2)}MB`);
        // Resize and compress the image
        imageData = await resizeAndCompressImage(file, maxSizeMB);
      } else {
        // Small enough, just read the file
        setProcessingStatus('画像を読み込み中...');
        imageData = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = (e) => resolve(e.target?.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });
        setProcessingStatus('');
      }
      
      // Handle iOS specific image orientation issues if needed
      if (isIOS) {
        setProcessingStatus('iOSデバイス向け処理中...');
        try {
          // Load image to handle orientation
          const img = new Image();
          await new Promise<void>((resolve, reject) => {
            img.onload = () => resolve();
            img.onerror = reject;
            img.src = imageData;
          });
          
          // Create canvas with correct orientation
          const canvas = document.createElement('canvas');
          canvas.width = img.width;
          canvas.height = img.height;
          
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(img, 0, 0);
            imageData = canvas.toDataURL(file.type || 'image/jpeg');
          }
        } catch (e) {
          console.error('iOS向け画像処理に失敗しました:', e);
        }
        setProcessingStatus('');
      }
      
      // 単一画像として保存
      setImage(imageData);
      console.log('画像処理完了');
      
    } catch (error) {
      console.error('画像処理エラー:', error);
      alert('画像の処理に失敗しました');
    } finally {
      setIsProcessingFile(false);
      setProcessingStatus('');
    }
  };

  // PDFファイルを処理する関数
  const handlePdfFile = async (file: File) => {
    // すでにPDFがある場合は処理しない
    if (pdf) {
      alert('PDFは1つまでしかアップロードできません。既存のPDFを削除してから再試行してください。');
      return;
    }
    
    // ファイル処理中フラグをオン
    setIsProcessingFile(true);
    setProcessingStatus('PDFファイルを処理中...');
    
    try {
      console.log('PDF処理開始:', {
        fileName: file.name,
        fileSize: `${(file.size / (1024 * 1024)).toFixed(2)}MB`,
        fileType: file.type
      });
      
      // PDFのデータURLを取得
      const dataUrl = await preparePdfForUpload(file);
      
      // PDFからテキストを抽出
      setProcessingStatus('PDFからテキストを抽出中...');
      const pdfDocument = await processPdfFile(dataUrl, file.name);
      
      // PDFドキュメントをステートに追加
      setPdf(pdfDocument);
      console.log('PDF処理完了:', file.name);
      
    } catch (error) {
      console.error('PDFファイル処理エラー:', error);
      alert(error instanceof Error ? error.message : 'PDFの処理に失敗しました');
    } finally {
      setIsProcessingFile(false);
      setProcessingStatus('');
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      
      if (file.type.startsWith('image/')) {
        // 画像がすでにある場合はユーザーに通知
        if (image) {
          alert('画像は1枚までしかアップロードできません。既存の画像を削除してから再試行してください。');
          e.target.value = '';
          return;
        }
        
        processImageFile(file);
      } else if (file.type === 'application/pdf') {
        // PDFがすでにある場合はユーザーに通知
        if (pdf) {
          alert('PDFは1つまでしかアップロードできません。既存のPDFを削除してから再試行してください。');
          e.target.value = '';
          return;
        }
        
        handlePdfFile(file);
      } else {
        console.warn('サポートされていないファイル形式です:', file.type);
      }
      
      // Reset the input value so the same file can be uploaded again
      e.target.value = '';
    }
  };

  // 画像を削除
  const removeImage = () => {
    setImage(null);
  };

  // PDFを削除
  const removePdf = () => {
    setPdf(null);
  };

  const adjustTextareaHeight = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const textarea = e.target;
    textarea.style.height = 'auto';
    textarea.style.height = `${Math.min(textarea.scrollHeight, 200)}px`;
    setInput(e.target.value);
    
    // 親コンポーネントに入力変更を通知
    if (onInputChange) {
      onInputChange(e.target.value);
    }
  };

  // テキストエリアの高さを初期化する
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`;
    }
  }, [input]);

  // iOSのカメラ起動処理を最適化
  const handleCameraCapture = () => {
    // 画像がすでにある場合はユーザーに通知
    if (image) {
      alert('画像は1枚までしかアップロードできません。既存の画像を削除してから再試行してください。');
      return;
    }
    
    if (fileInputRef.current) {
      if (isIOS) {
        // iOSではcaptureが効かない場合があるため、accept属性を調整
        fileInputRef.current.accept = 'image/*';
        // iOSでは'environment'をキャプチャに設定しても、
        // ユーザーが選択できるようにするため、敢えてcaptureを設定しない
        fileInputRef.current.removeAttribute('capture');
      } else {
        // iOS以外では'environment'を設定
        fileInputRef.current.setAttribute('capture', 'environment');
      }
      fileInputRef.current.click();
    }
  };

  return (
    <div className={`border-t border-gray-200 bg-white p-3 ${isIOS ? 'pb-safe' : ''}`}>
      <form ref={formRef} onSubmit={handleFormSubmit} className="max-w-3xl mx-auto">
        <div className="flex flex-col rounded-lg border border-gray-300 bg-white p-2">
          {/* 単一画像プレビュー */}
          {image && (
            <div className="flex flex-wrap gap-2 mb-2 overflow-x-auto py-1">
              <div className="relative flex-shrink-0">
                <img 
                  src={image} 
                  alt="Uploaded" 
                  className="h-16 w-16 sm:h-20 sm:w-20 object-cover rounded" 
                />
                <button
                  type="button"
                  onClick={removeImage}
                  className="absolute -top-2 -right-2 bg-blue-500 rounded-full p-1 text-white"
                  aria-label="画像を削除"
                >
                  <X size={14} />
                </button>
              </div>
            </div>
          )}
          
          {/* 単一PDFプレビュー */}
          {pdf && (
            <div className="flex flex-wrap gap-2 mb-2 overflow-x-auto py-1">
              <div className="relative flex-shrink-0">
                <div className="h-16 w-32 sm:h-20 sm:w-40 bg-blue-50 rounded flex flex-col justify-center items-center border border-blue-200">
                  <FileText size={24} className="text-blue-500" />
                  <p className="text-xs text-center text-gray-700 mt-1 truncate w-full px-2">
                    {pdf.name}
                  </p>
                  <p className="text-[10px] text-gray-500">{pdf.pageCount}ページ</p>
                </div>
                <button
                  type="button"
                  onClick={removePdf}
                  className="absolute -top-2 -right-2 bg-blue-500 rounded-full p-1 text-white"
                  aria-label="PDFを削除"
                >
                  <X size={14} />
                </button>
              </div>
            </div>
          )}

          <textarea
            ref={textareaRef}
            placeholder="質問してみましょう"
            value={input}
            onChange={adjustTextareaHeight}
            onKeyDown={handleKeyDown}
            onPaste={handlePaste}
            disabled={disabled || isProcessingFile}
            rows={1}
            className={`flex-1 bg-transparent outline-none resize-none min-h-[40px] max-h-[200px] p-2 text-base text-gray-800 ${isExceedingLimit ? 'text-red-500' : ''}`}
          />
          
          <div className="flex justify-between items-center mt-1">
            <div className="flex items-center">
              {/* 画像アップロード用input */}
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileUpload}
                accept="image/*"
                className="hidden"
              />
              
              {/* PDFアップロード用input */}
              <input
                type="file"
                ref={pdfInputRef}
                onChange={handleFileUpload}
                accept="application/pdf"
                className="hidden"
              />
              
              <div className="flex">
                {/* 画像アップロードボタン */}
                <button
                  type="button"
                  onClick={() => {
                    // すでに画像がある場合はユーザーに通知
                    if (image) {
                      alert('画像は1枚までしかアップロードできません。既存の画像を削除してから再試行してください。');
                      return;
                    }
                    fileInputRef.current?.click();
                  }}
                  className={`p-2 rounded-full ${isProcessingFile || image ? 'text-gray-300' : 'text-gray-500 hover:bg-gray-100'}`}
                  title={image ? "画像は1枚までしかアップロードできません" : "画像をアップロード"}
                  disabled={isProcessingFile || !!image}
                >
                  <ImageIcon size={isMobile ? 24 : 20} />
                </button>
                
                {/* PDFアップロードボタン */}
                <button
                  type="button"
                  onClick={() => {
                    // すでにPDFがある場合はユーザーに通知
                    if (pdf) {
                      alert('PDFは1つまでしかアップロードできません。既存のPDFを削除してから再試行してください。');
                      return;
                    }
                    pdfInputRef.current?.click();
                  }}
                  className={`p-2 rounded-full ${isProcessingFile || pdf ? 'text-gray-300' : 'text-gray-500 hover:bg-gray-100'}`}
                  title={pdf ? "PDFは1つまでしかアップロードできません" : "PDFをアップロード"}
                  disabled={isProcessingFile || !!pdf}
                >
                  <FileText size={isMobile ? 24 : 20} />
                </button>
                
                {/* カメラ起動ボタン（モバイルのみ） */}
                {isMobile && (
                  <button
                    type="button"
                    onClick={handleCameraCapture}
                    className={`p-2 rounded-full ${isProcessingFile || image ? 'text-gray-300' : 'text-gray-500 hover:bg-gray-100'}`}
                    title={image ? "画像は1枚までしかアップロードできません" : "カメラを起動"}
                    disabled={isProcessingFile || !!image}
                  >
                    <Camera size={24} />
                  </button>
                )}
              </div>
              
              {/* 処理ステータス表示 */}
              {processingStatus && (
                <div className="ml-2 flex items-center">
                  <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mr-1"></div>
                  <span className="text-xs text-blue-500">{processingStatus}</span>
                </div>
              )}
              
              {/* 文字カウンター表示 */}
              <div className={`ml-2 text-xs ${isExceedingLimit ? 'text-red-500 font-bold' : 'text-gray-400'}`}>
                {input.length}/{MAX_CHARS}
              </div>
            </div>
            
            {/* 送信ボタン */}
            <button
              type="button"
              onClick={sendMessage}
              disabled={disabled || isProcessingFile || (!input.trim() && !image && !pdf) || isExceedingLimit}
              className={`p-2 rounded-full ${
                disabled || isProcessingFile || (!input.trim() && !image && !pdf) || isExceedingLimit
                  ? 'text-gray-400'
                  : 'text-blue-500 hover:bg-blue-50'
              }`}
            >
              {isProcessingFile ? (
                <svg className="animate-spin h-5 w-5 text-gray-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
              ) : (
                <Send size={isMobile ? 24 : 20} />
              )}
            </button>
          </div>
          
          {/* 文字数制限を超えた場合のエラーメッセージ */}
          {isExceedingLimit && (
            <div className="mt-1 text-xs text-red-500">
              文字数制限（{MAX_CHARS}文字）を超えています。テキストを短くしてください。
            </div>
          )}
          
          {/* ファイル制限の説明 */}
          <div className="mt-1 text-xs text-gray-500">
            画像とPDFはそれぞれ1つまでアップロードできます。
          </div>
        </div>
      </form>
    </div>
  );
};

export default ChatInput;