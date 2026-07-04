"use client";
import { Component, type ReactNode } from "react";

interface Props { children: ReactNode; }
interface State { hasError: boolean; errorMsg: string; }

export class ChatErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, errorMsg: "" };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, errorMsg: error.message || "渲染错误" };
  }

  componentDidCatch(error: Error) {
    console.warn("[CHAT-BOUNDARY] Caught:", error.message);
    fetch("/api/telemetry", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "chat_boundary_error", message: error.message, stack: error.stack?.substring(0, 500), t: Date.now() }),
    }).catch(() => {});
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex-1 flex flex-col items-center justify-center gap-3 p-4">
          <p className="text-sm text-muted-foreground">对话渲染出错，点击下方按钮恢复</p>
          <button
            onClick={() => this.setState({ hasError: false, errorMsg: "" })}
            className="rounded-lg bg-primary px-4 py-2 text-sm text-primary-foreground hover:bg-primary/90"
          >
            恢复对话
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
