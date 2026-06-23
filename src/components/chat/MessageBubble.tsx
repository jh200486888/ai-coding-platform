'use client';

import { User, Bot, Image, FileText, Code } from 'lucide-react';
import type { Message, Attachment } from '@/types';

interface MessageBubbleProps {
  message: Message;
}

/** Format file size */
function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** Icon for attachment type */
function AttachmentTypeIcon({ type }: { type: Attachment['type'] }) {
  switch (type) {
    case 'image':
      return <Image className="w-3.5 h-3.5 text-blue-400" />;
    case 'code':
      return <Code className="w-3.5 h-3.5 text-green-400" />;
    default:
      return <FileText className="w-3.5 h-3.5 text-orange-400" />;
  }
}

/** Attachment display component */
function AttachmentItem({ attachment }: { attachment: Attachment }) {
  if (attachment.type === 'image') {
    return (
      <div className="group relative">
        <img
          src={attachment.url}
          alt={attachment.name}
          className="max-w-[200px] max-h-[150px] rounded-lg object-cover border border-border/50"
        />
        <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-[10px] px-2 py-1 rounded-b-lg opacity-0 group-hover:opacity-100 transition-opacity truncate">
          {attachment.name}
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 bg-muted/50 border border-border/50 rounded-lg px-3 py-2 max-w-[200px]">
      <AttachmentTypeIcon type={attachment.type} />
      <div className="min-w-0 flex-1">
        <div className="text-xs font-medium truncate">{attachment.name}</div>
        <div className="text-[10px] text-muted-foreground">{formatSize(attachment.size)}</div>
      </div>
    </div>
  );
}

export function MessageBubble({ message }: MessageBubbleProps) {
  const isUser = message.role === 'user';
  const hasAttachments = message.attachments && message.attachments.length > 0;

  return (
    <div className={`flex gap-3 ${isUser ? 'flex-row-reverse' : ''}`}>
      <div
        className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
          isUser ? 'bg-primary' : 'bg-muted'
        }`}
      >
        {isUser ? (
          <User className="w-4 h-4 text-primary-foreground" />
        ) : (
          <Bot className="w-4 h-4 text-muted-foreground" />
        )}
      </div>
      <div
        className={`flex-1 max-w-[80%] rounded-lg px-4 py-3 ${
          isUser
            ? 'bg-primary text-primary-foreground'
            : 'bg-card border border-border'
        }`}
      >
        {/* Attachments */}
        {hasAttachments && (
          <div className={`flex flex-wrap gap-2 mb-2 ${isUser ? 'justify-end' : 'justify-start'}`}>
            {message.attachments!.map(att => (
              <AttachmentItem key={att.id} attachment={att} />
            ))}
          </div>
        )}

        {/* Text content */}
        {message.content && (
          <div className="text-sm whitespace-pre-wrap break-words">
            {message.content}
          </div>
        )}

        {/* Timestamp */}
        <div
          className={`text-xs mt-1 ${
            isUser ? 'text-primary-foreground/70' : 'text-muted-foreground'
          }`}
        >
          {new Date(message.createdAt).toLocaleTimeString()}
        </div>
      </div>
    </div>
  );
}
