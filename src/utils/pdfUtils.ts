import * as pdfjsLib from 'pdfjs-dist';
import { PDFDocument } from '../types';
import { v4 as uuidv4 } from 'uuid';

// Set the PDF.js worker source
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

/**
 * Extract text from a PDF file
 * @param dataUrl Base64 data URL of the PDF
 * @param fileName Original filename
 * @returns Promise resolving to PDF document with extracted text
 */
export async function processPdfFile(dataUrl: string, fileName: string): Promise<PDFDocument> {
  try {
    console.log('PDFの処理を開始:', fileName);
    
    // Convert data URL to array buffer
    const base64Data = dataUrl.split(',')[1];
    const binaryString = window.atob(base64Data);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    
    // Load the PDF document
    const pdfDocument = await pdfjsLib.getDocument({ data: bytes }).promise;
    const numPages = pdfDocument.numPages;
    console.log(`PDF読み込み完了: ${numPages}ページ`);
    
    // Extract text from all pages
    let fullText = '';
    
    for (let i = 1; i <= numPages; i++) {
      const page = await pdfDocument.getPage(i);
      const textContent = await page.getTextContent();
      const pageText = textContent.items
        .map((item: any) => item.str)
        .join(' ');
      
      fullText += `--- Page ${i} ---\n${pageText}\n\n`;
    }
    
    // Create PDF document object
    const pdfDoc: PDFDocument = {
      id: uuidv4(),
      name: fileName,
      dataUrl: dataUrl,
      text: fullText,
      pageCount: numPages
    };
    
    console.log('PDF処理完了:', fileName);
    return pdfDoc;
    
  } catch (error) {
    console.error('PDF処理中にエラーが発生しました:', error);
    throw new Error('PDFからテキストを抽出できませんでした');
  }
}

/**
 * Resizes a PDF file if it's too large
 * @param file Original PDF file
 * @param maxSizeMB Maximum size in MB
 * @returns Promise resolving to data URL
 */
export async function preparePdfForUpload(file: File, maxSizeMB = 10): Promise<string> {
  return new Promise((resolve, reject) => {
    // Check if file is too large
    if (file.size > maxSizeMB * 1024 * 1024) {
      reject(new Error(`PDFファイルが大きすぎます (${(file.size / (1024 * 1024)).toFixed(2)}MB). 最大サイズは ${maxSizeMB}MB です。`));
      return;
    }
    
    // Convert file to data URL
    const reader = new FileReader();
    reader.onload = () => {
      resolve(reader.result as string);
    };
    reader.onerror = () => {
      reject(new Error('PDFファイルの読み込みに失敗しました'));
    };
    reader.readAsDataURL(file);
  });
}

/**
 * Get a summary of PDF content suitable for AI prompts
 * @param pdf PDF document
 * @param maxLength Maximum length of the summary
 * @returns Text summary
 */
export function getPdfSummaryForPrompt(pdf: PDFDocument, maxLength = 8000): string {
  // If the text is shorter than maxLength, return it directly
  if (pdf.text.length <= maxLength) {
    return pdf.text;
  }
  
  // Otherwise, create a summary with start and end of the document
  const halfLength = Math.floor(maxLength / 2);
  const start = pdf.text.substring(0, halfLength);
  const end = pdf.text.substring(pdf.text.length - halfLength);
  
  return `${start}\n\n[...PDFの中間部分は省略されています...]\n\n${end}`;
}