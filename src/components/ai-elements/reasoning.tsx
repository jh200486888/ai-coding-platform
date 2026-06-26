"use client";

import React, { useState, useEffect } from "react";
import { ChevronRight, Brain } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";

interface ReasoningContextValue {
  isStreaming?: boolean;
  isOpen?: boolean;
  setIsOpen?: (open: boolean) => void;
  duration?: number;
}

import { createContext, useContext } from "react";
const ReasoningContext = createContext<ReasoningContextValue>({});

function useReasoning() {
  return useContext(ReasoningContext);
}

interface ReasoningProps {
  isStreaming?: boolean;
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  duration?: number;
  className?: string;
  children: React.ReactNode;
}

function Reasoning({
  isStreaming = false,
  open: controlledOpen,
  defaultOpen,
  onOpenChange,
  duration = 300,
  className,
  children,
}: ReasoningProps) {
  const [internalOpen, setInternalOpen] = useState(defaultOpen ?? false);

  const isOpen = controlledOpen !== undefined ? controlledOpen : internalOpen;
  const setIsOpen = (value: boolean) => {
    setInternalOpen(value);
    onOpenChange?.(value);
  };

  // Auto-open when streaming starts, auto-close when streaming stops
  useEffect(() => {
    if (isStreaming) {
      setIsOpen(true);
    } else if (isOpen) {
      // Small delay before closing so user can see the final content
      const timer = setTimeout(() => setIsOpen(false), 500);
      return () => clearTimeout(timer);
    }
  }, [isStreaming]);

  return (
    <ReasoningContext.Provider value={{ isStreaming, isOpen, setIsOpen, duration }}>
      <Collapsible
        open={isOpen}
        onOpenChange={setIsOpen}
        className={cn("rounded-lg border border-border/50", className)}
      >
        {children}
      </Collapsible>
    </ReasoningContext.Provider>
  );
}

interface ReasoningTriggerProps {
  getThinkingMessage?: (isStreaming: boolean) => string;
  className?: string;
}

function ReasoningTrigger({
  getThinkingMessage,
  className,
}: ReasoningTriggerProps) {
  const { isStreaming, isOpen } = useReasoning();
  const defaultMessage = isStreaming ? "正在思考..." : "查看思考过程";

  return (
    <CollapsibleTrigger asChild>
      <button
        className={cn(
          "flex items-center gap-2 w-full px-3 py-2 text-xs text-muted-foreground hover:text-foreground transition-colors rounded-lg",
          className
        )}
      >
        <ChevronRight
          className={cn(
            "w-3.5 h-3.5 transition-transform duration-200",
            isOpen && "rotate-90"
          )}
        />
        <Brain className="w-3.5 h-3.5 text-violet-400" />
        {isStreaming && (
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-violet-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-violet-500" />
          </span>
        )}
        <span className="font-medium">
          {getThinkingMessage ? getThinkingMessage(!!isStreaming) : defaultMessage}
        </span>
      </button>
    </CollapsibleTrigger>
  );
}

interface ReasoningContentProps {
  children: React.ReactNode;
  className?: string;
}

function ReasoningContent({ children, className }: ReasoningContentProps) {
  return (
    <CollapsibleContent
      className={cn(
        "overflow-hidden data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:slide-up-1 data-[state=open]:slide-down-1",
        className
      )}
    >
      <div className="px-3 pb-2 text-xs text-muted-foreground/80 whitespace-pre-wrap break-words border-t border-border/30 pt-2 max-h-[300px] overflow-y-auto">
        {children}
      </div>
    </CollapsibleContent>
  );
}

export { Reasoning, ReasoningTrigger, ReasoningContent, useReasoning };
