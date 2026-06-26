"use client";

import { useRef, useEffect, useState, useCallback, type ReactNode } from "react";
import { ArrowDown, Download, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useStickToBottom } from "use-stick-to-bottom";

// ============ Context for scroll behavior ============

interface ConversationProps {
  className?: string;
  children: ReactNode;
}

function Conversation({ className, children }: ConversationProps) {
  return (
    <div className={cn("flex flex-col h-full relative", className)}>
      {children}
    </div>
  );
}

interface ConversationContentProps {
  className?: string;
  children: ReactNode;
}

function ConversationContent({ className, children }: ConversationContentProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [isAtBottom, setIsAtBottom] = useState(true);
  const [showScrollBtn, setShowScrollBtn] = useState(false);

  const checkBottom = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const distance = el.scrollHeight - el.scrollTop - el.clientHeight;
    const atBottom = distance < 80;
    setIsAtBottom(atBottom);
    setShowScrollBtn(!atBottom);
  }, []);

  // Auto-scroll to bottom when children change, but only if already near bottom
  useEffect(() => {
    if (isAtBottom && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  });

  const scrollToBottom = useCallback(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({
        top: scrollRef.current.scrollHeight,
        behavior: "smooth",
      });
      setIsAtBottom(true);
      setShowScrollBtn(false);
    }
  }, []);

  return (
    <div className="relative flex-1 min-h-0">
      <div
        ref={scrollRef}
        onScroll={checkBottom}
        className={cn("h-full overflow-y-auto p-3 md:p-4 space-y-4", className)}
      >
        {children}
      </div>
      {showScrollBtn && (
        <div className="absolute bottom-2 left-1/2 -translate-x-1/2 z-10">
          <button
            onClick={scrollToBottom}
            className="flex items-center gap-1 px-3 py-1.5 text-xs bg-primary text-primary-foreground rounded-full shadow-lg hover:bg-primary/90 transition-colors"
          >
            <ArrowDown className="w-3 h-3" />
            回到底部
          </button>
        </div>
      )}
    </div>
  );
}

interface ConversationEmptyStateProps {
  icon?: ReactNode;
  title?: string;
  description?: string;
  className?: string;
  children?: ReactNode;
}

function ConversationEmptyState({
  icon,
  title = "开始对话",
  description = "输入消息开始聊天",
  className,
  children,
}: ConversationEmptyStateProps) {
  return (
    <div className={cn("flex items-center justify-center h-full text-muted-foreground", className)}>
      <div className="text-center px-4 max-w-md">
        {icon && <div className="mb-4 flex justify-center">{icon}</div>}
        {title && <h3 className="text-lg font-medium mb-1">{title}</h3>}
        {description && <p className="text-sm mb-4">{description}</p>}
        {children}
      </div>
    </div>
  );
}

interface ConversationScrollButtonProps {
  className?: string;
}

function ConversationScrollButton({ className }: ConversationScrollButtonProps) {
  // This is handled internally by ConversationContent
  // Exported for API compatibility but the actual scroll button is in ConversationContent
  return null;
}

interface ConversationDownloadProps {
  messages: Array<{ role: string; content: string }>;
  filename?: string;
  className?: string;
}

function messagesToMarkdown(
  messages: Array<{ role: string; content: string }>,
  formatMessage?: (msg: { role: string; content: string }, index: number) => string
): string {
  return messages
    .map((msg, i) => {
      if (formatMessage) return formatMessage(msg, i);
      return `## ${msg.role === "user" ? "用户" : "AI"}\n\n${msg.content}`;
    })
    .join("\n\n---\n\n");
}

function ConversationDownload({ messages, filename = "conversation.md", className }: ConversationDownloadProps) {
  const handleDownload = () => {
    const md = messagesToMarkdown(messages);
    const blob = new Blob([md], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={handleDownload}
      className={cn("text-muted-foreground hover:text-foreground", className)}
      title="下载对话为Markdown"
    >
      <Download className="w-4 h-4" />
    </Button>
  );
}

export {
  Conversation,
  ConversationContent,
  ConversationEmptyState,
  ConversationScrollButton,
  ConversationDownload,
  messagesToMarkdown,
};
