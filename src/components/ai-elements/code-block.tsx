"use client";

import React, { useState, useCallback, useEffect } from "react";
import { Check, Copy, FileIcon } from "lucide-react";
import { cn } from "@/lib/utils";

// Use dynamic import to load shiki only on client side
let shikiLoaded = false;
let shikiModule: any = null;

async function loadShiki() {
  if (!shikiLoaded) {
    shikiModule = await import("shiki");
    shikiLoaded = true;
  }
  return shikiModule;
}

function useCodeHighlight(code: string, language: string) {
  const [highlighted, setHighlighted] = useState<string>("");

  useEffect(() => {
    let cancelled = false;
    loadShiki().then((shiki) => {
      if (cancelled) return;
      try {
        const html = shiki.codeToHtml(code, {
          lang: language || "text",
          theme: "github-dark",
        });
        setHighlighted(html);
      } catch {
        // Fallback if language not supported
        try {
          const html = shiki.codeToHtml(code, { lang: "text", theme: "github-dark" });
          setHighlighted(html);
        } catch {
          setHighlighted(`<pre><code>${code.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</code></pre>`);
        }
      }
    }).catch(() => {
      setHighlighted(`<pre><code>${code.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</code></pre>`);
    });
    return () => { cancelled = true; };
  }, [code, language]);

  return highlighted;
}

interface CodeBlockProps {
  code?: string;
  language?: string;
  showLineNumbers?: boolean;
  className?: string;
  children?: React.ReactNode;
}

function CodeBlock({ code: codeProp, language = "text", showLineNumbers = false, className, children }: CodeBlockProps) {
  const code = codeProp ?? (typeof children === "string" ? children : "");
  const highlighted = useCodeHighlight(code, language);
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(code).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }).catch(() => {});
  }, [code]);

  return (
    <div className={cn("my-2 rounded-lg overflow-hidden border border-border bg-[#0d1117]", className)}>
      <div className="flex items-center justify-between px-3 py-1.5 bg-[#16162a] border-b border-border">
        <div className="flex items-center gap-1.5">
          <FileIcon className="w-3 h-3 text-muted-foreground" />
          <span className="text-xs text-muted-foreground font-mono">{language || "code"}</span>
        </div>
        <button onClick={handleCopy} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors px-2 py-0.5 rounded hover:bg-muted/50">
          {copied ? (
            <><Check className="w-3 h-3 text-green-400" /><span className="text-green-400">已复制</span></>
          ) : (
            <><Copy className="w-3 h-3" /><span>复制</span></>
          )}
        </button>
      </div>
      {highlighted ? (
        <div
          className="text-sm overflow-x-auto [&_pre]:!bg-[#0d1117] [&_pre]:!p-3 [&_pre]:!m-0 [&_code]:!font-mono"
          dangerouslySetInnerHTML={{ __html: highlighted }}
        />
      ) : (
        <pre className="p-3 overflow-x-auto text-sm bg-[#0d1117]">
          <code className="text-green-300 font-mono whitespace-pre">{code}</code>
        </pre>
      )}
    </div>
  );
}

function CodeBlockHeader({ children, className }: { children?: React.ReactNode; className?: string }) {
  return <div className={cn("flex items-center justify-between px-3 py-1.5 bg-[#16162a] border-b border-border", className)}>{children}</div>;
}

function CodeBlockTitle({ children, className }: { children?: React.ReactNode; className?: string }) {
  return <div className={cn("flex items-center gap-1.5", className)}>{children}</div>;
}

function CodeBlockFilename({ children, className }: { children?: React.ReactNode; className?: string }) {
  return <span className={cn("text-xs text-muted-foreground font-mono", className)}>{children}</span>;
}

function CodeBlockActions({ children, className }: { children?: React.ReactNode; className?: string }) {
  return <div className={cn("flex items-center gap-2", className)}>{children}</div>;
}

function CodeBlockCopyButton({ className }: { className?: string }) {
  return null;
}

export { CodeBlock, CodeBlockHeader, CodeBlockTitle, CodeBlockFilename, CodeBlockActions, CodeBlockCopyButton };
