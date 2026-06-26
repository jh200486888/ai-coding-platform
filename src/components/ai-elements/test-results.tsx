"use client";

import React, { useState } from "react";
import { ChevronRight, CheckCircle2, XCircle, MinusCircle, Loader2 } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";

type TestStatus = "passed" | "failed" | "skipped" | "running";

interface TestResultsProps {
  summary?: {
    passed: number;
    failed: number;
    skipped: number;
    total: number;
    duration?: number;
  };
  className?: string;
  children?: React.ReactNode;
}

const STATUS_CONFIG: Record<TestStatus, { icon: typeof CheckCircle2; color: string; label: string }> = {
  passed: { icon: CheckCircle2, color: "text-green-500", label: "通过" },
  failed: { icon: XCircle, color: "text-red-500", label: "失败" },
  skipped: { icon: MinusCircle, color: "text-yellow-500", label: "跳过" },
  running: { icon: Loader2, color: "text-blue-500 animate-spin", label: "运行中" },
};

function TestResults({ summary, className, children }: TestResultsProps) {
  if (!summary) return null;
  const { passed, failed, skipped, total, duration } = summary;
  const passRate = total > 0 ? Math.round((passed / total) * 100) : 0;

  return (
    <div className={cn("rounded-lg border border-border/50 overflow-hidden", className)}>
      {/* Header */}
      <div className="px-4 py-3 bg-muted/30 border-b border-border/50">
        <div className="flex items-center gap-4 text-sm">
          <span className="text-green-500 font-medium">{passed} 通过</span>
          <span className="text-red-500 font-medium">{failed} 失败</span>
          <span className="text-yellow-500 font-medium">{skipped} 跳过</span>
          {duration !== undefined && (
            <span className="text-muted-foreground ml-auto text-xs">{duration}秒</span>
          )}
        </div>
        {/* Progress bar */}
        <div className="mt-2 h-1.5 rounded-full bg-muted overflow-hidden">
          <div className="h-full flex">
            <div className="bg-green-500" style={{ width: `${(passed / total) * 100}%` }} />
            <div className="bg-red-500" style={{ width: `${(failed / total) * 100}%` }} />
            <div className="bg-yellow-500" style={{ width: `${(skipped / total) * 100}%` }} />
          </div>
        </div>
        <div className="mt-1 text-xs text-muted-foreground">
          {passed}/{total} 测试已通过 · {passRate}%
        </div>
      </div>
      {/* Content */}
      <div className="p-2">
        {children}
      </div>
    </div>
  );
}

interface TestSuiteProps {
  name?: string;
  status?: TestStatus;
  defaultOpen?: boolean;
  className?: string;
  children?: React.ReactNode;
}

function TestSuite({ name = "", status = "passed", defaultOpen = true, className, children }: TestSuiteProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger asChild>
        <button className={cn("flex items-center gap-2 w-full px-2 py-1.5 text-sm hover:bg-muted/50 rounded transition-colors", className)}>
          <ChevronRight className={cn("w-3.5 h-3.5 transition-transform duration-200", isOpen && "rotate-90")} />
          <span className="font-medium">{name}</span>
          <span className="ml-auto text-xs text-muted-foreground">
            {React.Children.count(children)} 个测试
          </span>
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="ml-5 border-l border-border/50 pl-2 space-y-0.5">
          {children}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

interface TestProps {
  name?: string;
  status?: TestStatus;
  duration?: number;
  className?: string;
  children?: React.ReactNode;
}

function Test({ name = "", status = "passed", duration, className, children }: TestProps) {
  const config = STATUS_CONFIG[status];
  const Icon = config.icon;

  return (
    <div className={cn("py-0.5", className)}>
      <div className="flex items-center gap-2 px-2 py-1 text-sm">
        <Icon className={cn("w-3.5 h-3.5 shrink-0", config.color)} />
        <span className="truncate flex-1">{name}</span>
        {duration !== undefined && (
          <span className="text-xs text-muted-foreground">{duration}毫秒</span>
        )}
      </div>
      {status === "failed" && children && (
        <div className="ml-5 mt-1 mb-1">
          {children}
        </div>
      )}
    </div>
  );
}

function TestError({ children, className }: { children?: React.ReactNode; className?: string }) {
  return (
    <div className={cn("rounded bg-red-950/30 border border-red-900/50 p-2 text-xs", className)}>
      {children}
    </div>
  );
}

function TestErrorMessage({ children, className }: { children?: React.ReactNode; className?: string }) {
  return (
    <p className={cn("text-red-400 font-medium mb-1", className)}>{children}</p>
  );
}

function TestErrorStack({ children, className }: { children?: React.ReactNode; className?: string }) {
  return (
    <pre className={cn("text-muted-foreground/70 overflow-x-auto whitespace-pre-wrap text-[11px] font-mono", className)}>
      {children}
    </pre>
  );
}

export { TestResults, TestSuite, Test, TestError, TestErrorMessage, TestErrorStack };
export type { TestStatus };
