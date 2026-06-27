import { useState, useRef, useCallback } from 'react';
import type { Attachment } from '@/types';

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
        
        // For text/code files, also read content
        if (attachment.type === 'code' || file.type.startsWith('text/')) {
          attachment.content = await file.text();
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
