"use client";
import { useEffect } from "react";

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("[APP-ERROR]", error?.message);
    fetch("/api/telemetry", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "frontend_error", message: error?.message, stack: error?.stack?.substring(0, 800), url: location.href, t: Date.now() }),
    }).catch(() => {});
  }, [error]);

  return (
    <div className="flex h-full flex-col items-center justify-center gap-4">
      <h2 className="text-lg font-semibold text-foreground">出了点问题</h2>
      <p className="text-sm text-muted-foreground max-w-md text-center">
        {error?.message || "页面加载时发生错误"}
      </p>
      <div className="flex gap-2">
        <button onClick={reset} className="rounded-lg bg-primary px-4 py-2 text-sm text-primary-foreground hover:bg-primary/90">重试</button>
        <button onClick={() => window.location.reload()} className="rounded-lg border border-border px-4 py-2 text-sm text-foreground hover:bg-muted">刷新页面</button>
      </div>
    </div>
  );
}
