import { useState, useRef, useCallback } from 'react';
import type { Attachment } from '@/types';

// PDF text extraction (lazy loaded)
let pdfjsLib: any = null;
async function extractPdfText(file: File): Promise<string> {
  try {
    if (!pdfjsLib) {
      pdfjsLib = await import('pdfjs-dist');
      pdfjsLib.GlobalWorkerOptions.workerSrc = '';
    }
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer, useSystemFonts: true }).promise;
    const textParts: string[] = [];
    for (let i = 1; i <= Math.min(pdf.numPages, 50); i++) {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      const pageText = textContent.items.map((item: any) => item.str).join(' ');
      if (pageText.trim()) textParts.push(`[Page ${i}] ${pageText}`);
    }
    return textParts.join('\n');
  } catch (e: any) {
    return `[PDF解析失败: ${e.message || '未知错误'}]`;
  }
}

/** Maximum file size: 5MB */
const MAX_FILE_SIZE = 5 * 1024 * 1024;

/** Convert a File to a base64 data URL */
function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/** Classify a file into attachment type */
function classifyFile(file: File): Attachment['type'] {
  if (file.type.startsWith('image/')) return 'image';
  const codeExts = ['.ts', '.tsx', '.js', '.jsx', '.py', '.java', '.go', '.rs', '.c', '.cpp', '.h', '.css', '.html', '.json', '.yaml', '.yml', '.toml', '.sql', '.sh', '.bash', '.zsh'];
  const ext = '.' + file.name.split('.').pop()?.toLowerCase();
  if (codeExts.includes(ext)) return 'code';
  return 'document';
}


/** Extract text from .docx files using mammoth */


/** Extract text from .docx files using mammoth */
async function extractDocxText(file: File): Promise<string> {
  try {
    const mammoth = await import('mammoth');
    const arrayBuffer = await file.arrayBuffer();
    const result = await mammoth.extractRawText({ arrayBuffer });
    return result.value || '[Word文档内容为空]';
  } catch (e: any) {
    try { const text = await file.text(); if (text && text.length > 20) return text.slice(0, 8000); } catch {}
    return '[Word文档解析失败: ' + (e.message || '未知错误') + ']';
  }
}

interface UseFileUploadOptions {
  onError?: (message: string) => void;
}

export function useFileUpload(options: UseFileUploadOptions = {}) {
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFiles = useCallback(async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    
    const validFiles: Attachment[] = [];
    const errors: string[] = [];
    
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (file.size > MAX_FILE_SIZE) {
        errors.push(`${file.name} 超过 5MB 限制`);
        continue;
      }
      
      try {
        const url = await fileToBase64(file);
        const attachment: Attachment = {
          id: `${Date.now()}-${i}`,
          name: file.name,
          type: classifyFile(file),
          mimeType: file.type || 'application/octet-stream',
          size: file.size,
          url,
        };
        
        // Extract text content for AI to understand
        if (attachment.type === 'code' || file.type.startsWith('text/')) {
          attachment.content = await file.text();
        } else if (file.type === 'application/pdf' || file.name.endsWith('.pdf')) {
          attachment.content = await extractPdfText(file);
        } else if (file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || file.name.endsWith('.docx')) {
          attachment.content = await extractDocxText(file);
        } else if (file.type === 'application/msword' || file.name.endsWith('.doc')) {
          try { attachment.content = (await file.text()).slice(0, 8000); } catch { attachment.content = '[旧版Word文档，建议转换为.docx格式]'; }
        } else if (file.type === 'application/json' || file.name.endsWith('.json')) {
          attachment.content = await file.text();
        } else if (file.type.startsWith('application/') && file.size < 500000) {
          // Try reading as text for other small application files (csv, xml, etc.)
          try {
            const text = await file.text();
            if (text && !text.includes('\x00') && text.length > 10) {
              attachment.content = text;
            }
          } catch {}
        }
        
        validFiles.push(attachment);
      } catch {
        errors.push(`${file.name} 读取失败`);
      }
    }
    
    if (errors.length > 0) {
      options.onError?.(errors.join('；'));
    }
    
    if (validFiles.length > 0) {
      setAttachments(prev => [...prev, ...validFiles]);
    }
  }, [options.onError]);

  const removeAttachment = useCallback((id: string) => {
    setAttachments(prev => prev.filter(att => att.id !== id));
  }, []);

  const clearAttachments = useCallback(() => {
    setAttachments([]);
  }, []);

  return {
    attachments,
    setAttachments,
    fileInputRef,
    handleFiles,
    removeAttachment,
    clearAttachments,
  };
}
