"use client";

import { useState } from "react";
import { ChevronRight, ExternalLink, FileText } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";

interface SourcesProps {
  className?: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}

function Sources({ className, children, defaultOpen = false }: SourcesProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen} className={cn("rounded-lg border border-border/50", className)}>
      {children}
    </Collapsible>
  );
}

interface SourcesTriggerProps {
  count: number;
  className?: string;
}

function SourcesTrigger({ count, className }: SourcesTriggerProps) {
  return (
    <CollapsibleTrigger asChild>
      <button
        className={cn(
          "flex items-center gap-2 w-full px-3 py-2 text-xs text-muted-foreground hover:text-foreground transition-colors rounded-lg",
          className
        )}
      >
        <ChevronRight className="w-3.5 h-3.5 transition-transform duration-200 [[data-state=open]>&]:rotate-90" />
        <FileText className="w-3.5 h-3.5 text-emerald-400" />
        <span className="font-medium">已使用{count}个来源</span>
      </button>
    </CollapsibleTrigger>
  );
}

interface SourcesContentProps {
  className?: string;
  children: React.ReactNode;
}

function SourcesContent({ className, children }: SourcesContentProps) {
  return (
    <CollapsibleContent
      className={cn(
        "overflow-hidden data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:slide-up-1 data-[state=open]:slide-down-1",
        className
      )}
    >
      <div className="px-1 pb-2 space-y-0.5 border-t border-border/30 pt-1">
        {children}
      </div>
    </CollapsibleContent>
  );
}

interface SourceProps {
  href: string;
  title: string;
  className?: string;
}

function Source({ href, title, className }: SourceProps) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        "flex items-center gap-2 px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground hover:bg-muted/50 rounded transition-colors group",
        className
      )}
    >
      <ExternalLink className="w-3 h-3 shrink-0 text-emerald-400/60 group-hover:text-emerald-400" />
      <span className="truncate flex-1">{title || href}</span>
    </a>
  );
}

export { Sources, SourcesTrigger, SourcesContent, Source };
