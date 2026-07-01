import React, { useState, useEffect, useRef } from 'react';
import { Copy, Check, Table, FileText, X } from 'lucide-react';
import { Message, PDFDocument } from '../types';
import 'katex/dist/katex.min.css';
import { InlineMath, BlockMath } from 'react-katex';
import { parseTablesFromMarkdown } from '../utils/exportUtils';

interface ChatMessageProps {
  message: Message;
  onExportTableToExcel?: (message: Message) => void;
}

const ChatMessage: React.FC<ChatMessageProps> = ({ 
  message, 
  onExportTableToExcel
}) => {
  const isUser = message.role === 'user';
  const [displayedText, setDisplayedText] = useState('');
  const [isAnimating, setIsAnimating] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showCopy, setShowCopy] = useState(false);
  const [hasTable, setHasTable] = useState(false);
  const [selectedPdf, setSelectedPdf] = useState<PDFDocument | null>(null);
  const [showPdfContent, setShowPdfContent] = useState(false);
  const fullContent = message.content || '';
  const animationRef = useRef<number | null>(null);
  const characterIndex = useRef(0);
  const typingSpeed = 15; // ミリ秒単位の文字表示速度 (調整可能)

  // メッセージ内にテーブルがあるかチェックする
  useEffect(() => {
    if (!isUser && fullContent) {
      try {
        const tables = parseTablesFromMarkdown(fullContent);
        setHasTable(tables.length > 0);
      } catch (err) {
        console.error('テーブル検出エラー:', err);
        setHasTable(false);
      }
    }
  }, [fullContent, isUser]);

  // 数式を処理して表示する関数
  const renderMathContent = (text: string) => {
    if (!text) return null;

    // 正規表現パターンを改良
    // バックスラッシュ + [ を検出するためのより堅牢なパターン
    const blockMathRegex = /\\(?:\[)([\s\S]*?)\\(?:\])/g;
    const inlineMathRegex = /\\(?:\()([\s\S]*?)\\(?:\))/g;
    const dollarBlockMathRegex = /\$\$([\s\S]*?)\$\$/g;
    const dollarInlineMathRegex = /\$((?!\$)[\s\S]*?)\$/g;

    // 特殊トークンを使用して、数式を一時的にマークする
    let tokenCounter = 0;
    const mathTokens: Record<string, { type: 'inline' | 'block', content: string }> = {};
    
    // 処理用の作業テキスト
    let workingText = text;
    
    // 1. まずブロック数式（バックスラッシュ記法）を処理
    workingText = workingText.replace(blockMathRegex, (match, content) => {
      const token = `__MATH_TOKEN_${tokenCounter++}__`;
      mathTokens[token] = { type: 'block', content };
      return token;
    });
    
    // 2. インライン数式（バックスラッシュ記法）を処理
    workingText = workingText.replace(inlineMathRegex, (match, content) => {
      const token = `__MATH_TOKEN_${tokenCounter++}__`;
      mathTokens[token] = { type: 'inline', content };
      return token;
    });
    
    // 3. ドル記号のブロック数式を処理
    workingText = workingText.replace(dollarBlockMathRegex, (match, content) => {
      const token = `__MATH_TOKEN_${tokenCounter++}__`;
      mathTokens[token] = { type: 'block', content };
      return token;
    });
    
    // 4. ドル記号のインライン数式を処理
    workingText = workingText.replace(dollarInlineMathRegex, (match, content) => {
      const token = `__MATH_TOKEN_${tokenCounter++}__`;
      mathTokens[token] = { type: 'inline', content };
      return token;
    });
    
    // トークンを数式に戻す
    const parts: React.ReactNode[] = [];
    
    // テキストを分割して処理
    const textParts = workingText.split(/(\_\_MATH\_TOKEN\_\d+\_\_)/);
    textParts.forEach((part, index) => {
      // トークンが見つかったら数式に置き換え、それ以外はテキストとして表示
      if (part.match(/\_\_MATH\_TOKEN\_\d+\_\_/)) {
        const mathData = mathTokens[part];
        if (mathData) {
          try {
            if (mathData.type === 'block') {
              parts.push(
                <div key={index} className="my-2">
                  <BlockMath math={mathData.content} />
                </div>
              );
            } else {
              parts.push(<InlineMath key={index} math={mathData.content} />);
            }
          } catch (error) {
            console.error('数式レンダリングエラー:', error, mathData);
            parts.push(
              <span key={index} className="text-red-500">
                {mathData.type === 'block' ? `\\[${mathData.content}\\]` : `\\(${mathData.content}\\)`}
              </span>
            );
          }
        }
      } else if (part.trim()) {
        // 通常のテキスト（空でない場合のみ追加）
        parts.push(<span key={index}>{part}</span>);
      }
    });
    
    return parts;
  };
  
  // 新しいメッセージにアニメーション効果を適用する
  useEffect(() => {
    // ユーザーメッセージはアニメーションしない
    if (isUser || !fullContent) {
      setDisplayedText(fullContent);
      return;
    }
    
    // アクティブな新しいチャットのメッセージのみアニメーション
    if (message.isNew === true) {
      console.log('Animating new message:', message.id);
      // アニメーションが必要なので初期状態をリセット
      setDisplayedText('');
      characterIndex.current = 0;
      setIsAnimating(true);
      
      // 文字単位のアニメーション関数
      const animateTyping = () => {
        if (characterIndex.current < fullContent.length) {
          // 次の文字を追加
          const nextChar = fullContent.charAt(characterIndex.current);
          setDisplayedText(prev => prev + nextChar);
          characterIndex.current++;
          
          // 次の文字のアニメーションをスケジュール
          animationRef.current = window.setTimeout(animateTyping, typingSpeed);
        } else {
          // アニメーション完了
          setIsAnimating(false);
          // 最終確認：表示テキストが完全なテキストと一致することを確認
          if (displayedText !== fullContent) {
            setDisplayedText(fullContent);
          }
        }
      };
      
      // アニメーション開始
      // 最初の文字が欠落する問題を修正するため、わずかな遅延を追加
      animationRef.current = window.setTimeout(() => {
        // 最初の文字を表示してからアニメーション開始
        if (fullContent.length > 0) {
          const firstChar = fullContent.charAt(0);
          setDisplayedText(firstChar);
          characterIndex.current = 1;
          
          // 残りの文字のアニメーションを開始
          if (fullContent.length > 1) {
            animationRef.current = window.setTimeout(animateTyping, typingSpeed);
          } else {
            setIsAnimating(false);
          }
        }
      }, 50);
    } else {
      // 保存済みメッセージは即座に全テキスト表示
      setDisplayedText(fullContent);
    }
    
    return () => {
      if (animationRef.current !== null) {
        clearTimeout(animationRef.current);
        animationRef.current = null;
      }
    };
  }, [fullContent, isUser, message.isNew]);
  
  // ユーザーがクリックしたらアニメーションをスキップして全テキスト表示
  const handleClick = () => {
    if (isAnimating) {
      // アニメーションを停止
      if (animationRef.current !== null) {
        clearTimeout(animationRef.current);
        animationRef.current = null;
      }
      
      // 全テキストを表示
      setDisplayedText(fullContent);
      setIsAnimating(false);
    }
  };
  
  // メッセージをコピーする機能
  const copyMessageToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(fullContent);
      setCopied(true);
      setTimeout(() => {
        setCopied(false);
      }, 2000); // 2秒後にコピー成功表示を消す
    } catch (err) {
      console.error('Failed to copy text: ', err);
    }
  };
  
  // テーブルのみをExcelにエクスポート
  const handleExportTableClick = () => {
    if (onExportTableToExcel && !isUser) {
      onExportTableToExcel(message);
    }
  };
  
  // PDFの内容を表示/非表示切り替え
  const togglePdfContent = (pdf: PDFDocument) => {
    if (selectedPdf && selectedPdf.id === pdf.id) {
      setShowPdfContent(!showPdfContent);
    } else {
      setSelectedPdf(pdf);
      setShowPdfContent(true);
    }
  };
  
  return (
    <div 
      className={`py-5 ${isUser ? 'bg-gray-50' : 'bg-white'}`}
      onMouseEnter={() => setShowCopy(true)}
      onMouseLeave={() => setShowCopy(false)}
    >
      <div className="max-w-3xl mx-auto px-4">
        <div className="flex items-start">
          <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${isUser ? 'bg-blue-500' : 'bg-green-500'}`}>
            {isUser ? (
              <span className="text-white text-sm">U</span>
            ) : (
              <span className="text-white text-sm">AI</span>
            )}
          </div>
          <div className="ml-4 flex-1 relative group">
            <div className="flex justify-between items-center">
              <div className="text-sm font-medium">
                {isUser ? 'You' : 'OpenAI'}
              </div>
              
              <div className="flex space-x-2">
                {!isUser && hasTable && (
                  <button 
                    onClick={handleExportTableClick}
                    className="p-1.5 rounded-md text-sm bg-green-100 text-green-600 hover:bg-green-200"
                    aria-label="表をExcelにエクスポート"
                    title="表をExcelにエクスポート"
                  >
                    <div className="flex items-center space-x-1">
                      <Table size={14} />
                      <span className="text-xs hidden sm:inline">表をExcel化</span>
                    </div>
                  </button>
                )}
                
                {fullContent && (showCopy || copied) && (
                  <button 
                    onClick={copyMessageToClipboard}
                    className={`p-1.5 rounded-md text-sm ${
                      copied ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                    aria-label={copied ? "コピーしました" : "メッセージをコピー"}
                    title={copied ? "コピーしました" : "メッセージをコピー"}
                  >
                    <div className="flex items-center space-x-1">
                      {copied ? (
                        <>
                          <Check size={14} />
                          <span className="text-xs hidden sm:inline">コピー完了</span>
                        </>
                      ) : (
                        <>
                          <Copy size={14} />
                          <span className="text-xs hidden sm:inline">コピー</span>
                        </>
                      )}
                    </div>
                  </button>
                )}
              </div>
            </div>
            
            {/* PDFファイル表示 */}
            {message.pdfs && message.pdfs.length > 0 && (
              <div className="mt-2 mb-2">
                <p className="text-xs text-gray-500 mb-1">添付PDFファイル:</p>
                <div className="flex flex-wrap gap-2">
                  {message.pdfs.map((pdf) => (
                    <div 
                      key={pdf.id} 
                      className="cursor-pointer flex items-center p-2 rounded border border-blue-200 bg-blue-50 hover:bg-blue-100"
                      onClick={() => togglePdfContent(pdf)}
                    >
                      <FileText size={16} className="text-blue-500 mr-2" />
                      <div>
                        <p className="text-sm font-medium">{pdf.name}</p>
                        <p className="text-xs text-gray-500">{pdf.pageCount}ページ</p>
                      </div>
                    </div>
                  ))}
                </div>
                
                {selectedPdf && showPdfContent && (
                  <div className="mt-3 border rounded-md p-3 bg-blue-50 text-sm">
                    <div className="flex justify-between items-center mb-2">
                      <h4 className="font-medium">PDF内容: {selectedPdf.name}</h4>
                      <button 
                        onClick={() => setShowPdfContent(false)}
                        className="text-blue-500 hover:text-blue-700"
                      >
                        <X size={16} />
                      </button>
                    </div>
                    <div className="max-h-80 overflow-y-auto whitespace-pre-wrap text-gray-700 text-xs font-mono">
                      {selectedPdf.text}
                    </div>
                  </div>
                )}
              </div>
            )}
            
            {/* Display images if any */}
            {message.images && message.images.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-2">
                {message.images.map((image, index) => (
                  <div key={index} className="relative">
                    <img 
                      src={image} 
                      alt={`Uploaded ${index + 1}`} 
                      className="max-w-full max-h-80 rounded-lg object-contain"
                    />
                  </div>
                ))}
              </div>
            )}
            
            {/* テキストコンテンツ - KaTeXによる数式レンダリング対応 */}
            {fullContent && (
              <div 
                className="mt-1 text-sm whitespace-pre-wrap cursor-pointer"
                onClick={handleClick}
              >
                {isAnimating ? (
                  <>
                    {renderMathContent(displayedText)}
                    <span className="ml-1 text-transparent animate-pulse border-l-2 border-gray-400 h-4 inline-block">&nbsp;</span>
                  </>
                ) : (
                  renderMathContent(displayedText)
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ChatMessage;