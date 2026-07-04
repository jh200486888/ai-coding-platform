"use client";

import { useEffect, useState, useCallback } from "react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const [autoRetried, setAutoRetried] = useState(false);
  const isNullLengthError = error?.message?.includes("null") && error?.message?.includes("length");

  // Auto-retry for null.length errors (known AI SDK issue)
  useEffect(() => {
    if (isNullLengthError && !autoRetried) {
      console.warn("[ERROR-BOUNDARY] Auto-retrying null.length error");
      setAutoRetried(true);
      // Report to server
      fetch("/api/telemetry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "null_length_auto_retry",
          message: error?.message,
          stack: error?.stack?.substring(0, 800),
          url: window.location.href,
          timestamp: Date.now(),
        }),
      }).catch(() => {});
      // Auto-retry after brief delay
      setTimeout(() => reset(), 100);
    }
  }, [error, autoRetried, isNullLengthError, reset]);

  // Report non-auto-retry errors
  useEffect(() => {
    if (!isNullLengthError || autoRetried) {
      console.error("Application error:", error?.message);
      fetch("/api/telemetry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "frontend_error",
          message: error?.message,
          stack: error?.stack?.substring(0, 1000),
          digest: error?.digest,
          url: window.location.href,
          timestamp: Date.now(),
        }),
      }).catch(() => {});
    }
  }, [error, autoRetried, isNullLengthError]);

  // For null.length errors that auto-retried, show a brief loading state
  if (isNullLengthError && !autoRetried) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-sm text-muted-foreground animate-pulse">正在恢复...</div>
      </div>
    );
  }

  // For null.length errors after retry still fails, show soft error
  if (isNullLengthError && autoRetried) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4">
        <h2 className="text-lg font-semibold text-foreground">对话出现小问题</h2>
        <p className="text-sm text-muted-foreground max-w-md text-center">
          页面渲染遇到临时错误，请刷新页面重试。
        </p>
        <div className="flex gap-2">
          <button onClick={reset} className="rounded-lg bg-primary px-4 py-2 text-sm text-primary-foreground hover:bg-primary/90">
            重试
          </button>
          <button onClick={() => window.location.reload()} className="rounded-lg border border-border px-4 py-2 text-sm text-foreground hover:bg-muted">
            刷新页面
          </button>
        </div>
      </div>
    );
  }

  // Generic error page for other errors
  return (
    <div className="flex h-full flex-col items-center justify-center gap-4">
      <h2 className="text-lg font-semibold text-foreground">出了点问题</h2>
      <p className="text-sm text-muted-foreground max-w-md text-center">
        {error?.message || "页面加载时发生错误，请刷新页面重试。"}
      </p>
      <div className="flex gap-2">
        <button onClick={reset} className="rounded-lg bg-primary px-4 py-2 text-sm text-primary-foreground hover:bg-primary/90">
          重试
        </button>
        <button onClick={() => window.location.reload()} className="rounded-lg border border-border px-4 py-2 text-sm text-foreground hover:bg-muted">
          刷新页面
        </button>
      </div>
    </div>
  );
}
