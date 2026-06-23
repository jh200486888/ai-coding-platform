'use client';

import { useState, useRef } from 'react';
import { Upload, X } from 'lucide-react';

interface UploadAreaProps {
  onUpload: (url: string) => void;
}

export function UploadArea({ onUpload }: UploadAreaProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFile = async (file: File) => {
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch('/api/workspace/upload', {
        method: 'POST',
        body: formData,
      });

      if (response.ok) {
        const data = await response.json();
        onUpload(data.url);
      }
    } catch (error) {
      console.error('Upload error:', error);
    } finally {
      setUploading(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  return (
    <div
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      className={`border-2 border-dashed rounded-lg p-4 text-center transition-colors ${
        isDragging ? 'border-primary bg-primary/10' : 'border-border'
      }`}
    >
      {uploading ? (
        <div className="text-sm text-muted-foreground">上传中...</div>
      ) : (
        <>
          <Upload className="w-8 h-8 mx-auto text-muted-foreground mb-2" />
          <p className="text-sm text-muted-foreground mb-2">
            拖拽文件到此处或
          </p>
          <button
            onClick={() => fileInputRef.current?.click()}
            className="text-sm text-primary hover:underline"
          >
            选择文件
          </button>
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            onChange={e => {
              const file = e.target.files?.[0];
              if (file) handleFile(file);
            }}
            accept="image/*,.pdf,.txt,.md,.js,.ts,.py,.html,.css,.json"
          />
          <p className="text-xs text-muted-foreground mt-2">
            支持图片、文档、代码文件
          </p>
        </>
      )}
    </div>
  );
}
