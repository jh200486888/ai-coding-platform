'use client';
import { toast } from 'sonner';

import { useState, useRef } from 'react';
import { Paperclip, Upload, X, Image, FileText, FileCode } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface Attachment {
  name: string;
  type: string;
  size: number;
  content: string;
  preview?: string;
}

interface AttachmentUploadProps {
  onAttachmentsChange: (attachments: Attachment[]) => void;
  maxFiles?: number;
  maxSize?: number; // in bytes
}

const ACCEPTED_TYPES = {
  image: ['image/png', 'image/jpeg', 'image/gif', 'image/webp', 'image/svg+xml'],
  document: ['application/pdf', 'text/plain', 'text/markdown'],
  code: [
    'text/javascript',
    'text/typescript',
    'text/python',
    'text/html',
    'text/css',
    'application/json',
    'text/xml',
    'application/xml',
  ],
};

const ALL_ACCEPTED = [
  ...ACCEPTED_TYPES.image,
  ...ACCEPTED_TYPES.document,
  ...ACCEPTED_TYPES.code,
  '.js', '.jsx', '.ts', '.tsx', '.py', '.html', '.css', '.scss',
  '.json', '.md', '.txt', '.xml', '.yaml', '.yml', '.sql',
  '.sh', '.bash', '.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg', '.pdf',
].join(',');

function getFileIcon(type: string) {
  if (ACCEPTED_TYPES.image.includes(type)) {
    return <Image className="w-4 h-4 text-blue-400" />;
  }
  if (ACCEPTED_TYPES.document.includes(type)) {
    return <FileText className="w-4 h-4 text-green-400" />;
  }
  if (ACCEPTED_TYPES.code.includes(type) || type.startsWith('text/')) {
    return <FileCode className="w-4 h-4 text-yellow-400" />;
  }
  return <FileText className="w-4 h-4 text-gray-400" />;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

export function AttachmentUpload({
  onAttachmentsChange,
  maxFiles = 10,
  maxSize = 10 * 1024 * 1024, // 10MB
}: AttachmentUploadProps) {
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const processFile = async (file: File): Promise<Attachment | null> => {
    if (file.size > maxSize) {
      toast.warning(`文件 ${file.name} 超过最大限制 ${formatFileSize(maxSize)}`);
      return null;
    }

    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => {
        const content = reader.result as string;
        const attachment: Attachment = {
          name: file.name,
          type: file.type,
          size: file.size,
          content: content,
        };

        // Generate preview for images
        if (ACCEPTED_TYPES.image.includes(file.type)) {
          attachment.preview = content;
        }

        resolve(attachment);
      };
      reader.onerror = () => resolve(null);

      // Read as data URL for images, text for others
      if (ACCEPTED_TYPES.image.includes(file.type)) {
        reader.readAsDataURL(file);
      } else {
        reader.readAsText(file);
      }
    });
  };

  const handleFiles = async (files: FileList | File[]) => {
    if (attachments.length + files.length > maxFiles) {
      toast.warning(`最多只能上传 ${maxFiles} 个文件`);
      return;
    }

    setIsUploading(true);
    const newAttachments: Attachment[] = [];

    for (const file of Array.from(files)) {
      const attachment = await processFile(file);
      if (attachment) {
        newAttachments.push(attachment);
      }
    }

    const updated = [...attachments, ...newAttachments];
    setAttachments(updated);
    onAttachmentsChange(updated);
    setIsUploading(false);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files.length > 0) {
      handleFiles(e.dataTransfer.files);
    }
  };

  const removeAttachment = (index: number) => {
    const updated = attachments.filter((_, i) => i !== index);
    setAttachments(updated);
    onAttachmentsChange(updated);
  };

  const handleClick = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className="relative">
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept={ALL_ACCEPTED}
        onChange={(e) => {
          if (e.target.files) {
            handleFiles(e.target.files);
          }
          e.target.value = '';
        }}
        className="hidden"
      />

      <button
        onClick={handleClick}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={cn(
          'p-3 rounded-lg transition-colors',
          isDragging
            ? 'bg-primary/20 text-primary'
            : 'bg-gray-800 text-gray-400 hover:text-gray-200 hover:bg-gray-700'
        )}
        title="上传附件"
      >
        {isUploading ? (
          <div className="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin" />
        ) : (
          <Paperclip className="w-5 h-5" />
        )}
      </button>

      {/* Drop zone overlay */}
      {isDragging && (
        <div className="absolute inset-0 flex items-center justify-center bg-primary/10 border-2 border-dashed border-primary rounded-lg pointer-events-none">
          <div className="text-center">
            <Upload className="w-8 h-8 mx-auto text-primary mb-2" />
            <p className="text-sm text-primary">释放文件以上传</p>
          </div>
        </div>
      )}
    </div>
  );
}

// Attachment preview component
interface AttachmentPreviewProps {
  attachments: Attachment[];
  onRemove: (index: number) => void;
}

export function AttachmentPreview({ attachments, onRemove }: AttachmentPreviewProps) {
  if (attachments.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-2 mb-2">
      {attachments.map((att, i) => (
        <div
          key={i}
          className="relative group bg-gray-800 rounded-lg overflow-hidden"
        >
          {att.preview ? (
            <img
              src={att.preview}
              alt={att.name}
              className="w-16 h-16 object-cover"
            />
          ) : (
            <div className="w-16 h-16 flex items-center justify-center">
              {getFileIcon(att.type)}
            </div>
          )}
          
          <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
            <button
              onClick={() => onRemove(i)}
              className="p-1 bg-red-500 rounded-full"
            >
              <X className="w-3 h-3 text-white" />
            </button>
          </div>
          
          <div className="absolute bottom-0 left-0 right-0 bg-black/70 px-1 py-0.5">
            <p className="text-xs text-gray-300 truncate">{att.name}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
