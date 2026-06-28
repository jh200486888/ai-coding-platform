"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";

export default function MarkdownPreviewPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  const [content, setContent] = useState<string>("");
  const [title, setTitle] = useState("文档预览");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadDoc = async () => {
      try {
        const res = await fetch("/api/conversations/" + id);
        if (res.ok) {
          const data = await res.json();
          const msgs = data.data?.messages || [];
          const assistantTexts = msgs
            .filter((m: any) => m.role === "assistant")
            .map((m: any) => {
              const c = m.content || "";
              return c.replace(/\n\n<!--EXEC_LOG[\s\S]*?-->/, "").trim();
            })
            .filter(Boolean);
          if (assistantTexts.length > 0) {
            setContent(assistantTexts.join("\n\n---\n\n"));
          }
          const firstUser = msgs.find((m: any) => m.role === "user");
          if (firstUser) {
            const t = (firstUser.content || "").slice(0, 50).replace(/\n/g, " ");
            setTitle(t);
          }
        }
      } catch (e) {
        console.error("Failed to load document:", e);
      } finally {
        setLoading(false);
      }
    };
    loadDoc();
  }, [id]);

  const handleExport = async (format: string) => {
    try {
      const res = await fetch("/api/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content, format, title }),
      });
      if (!res.ok) {
        const err = await res.json();
        alert(err.error || "导出失败");
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const ext = format === "html" ? "html" : format;
      a.download = title + "." + ext;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (e: any) {
      alert("导出失败: " + e.message);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0f0f14] flex items-center justify-center">
        <div className="text-[#94a3b8] text-sm">加载中...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0f0f14]">
      <div className="sticky top-0 z-10 bg-[#16161e] border-b border-[#2a2a3a] px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.back()}
            className="p-1.5 rounded-lg hover:bg-[#1e1e2a] text-[#94a3b8] transition-colors"
            title="返回"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M19 12H5M12 19l-7-7 7-7" />
            </svg>
          </button>
          <h1 className="text-[#e2e8f0] text-sm font-medium truncate max-w-md">{title}</h1>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => handleExport("md")}
            className="px-3 py-1.5 rounded-lg text-xs bg-[#1e1e2a] text-[#94a3b8] hover:bg-[#7c3aed] hover:text-white border border-[#2a2a3a] transition-all"
          >
            MD
          </button>
          <button
            onClick={() => handleExport("html")}
            className="px-3 py-1.5 rounded-lg text-xs bg-[#1e1e2a] text-[#94a3b8] hover:bg-[#7c3aed] hover:text-white border border-[#2a2a3a] transition-all"
          >
            HTML
          </button>
          <button
            onClick={() => handleExport("txt")}
            className="px-3 py-1.5 rounded-lg text-xs bg-[#1e1e2a] text-[#94a3b8] hover:bg-[#7c3aed] hover:text-white border border-[#2a2a3a] transition-all"
          >
            TXT
          </button>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-6 py-8">
        <div className="markdown-preview prose prose-invert prose-violet max-w-none
          prose-headings:text-[#e2e8f0] prose-h1:text-2xl prose-h1:border-b prose-h1:border-[#2a2a3a] prose-h1:pb-3
          prose-h2:text-xl prose-h2:text-[#a78bfa] prose-h3:text-lg prose-h3:text-[#8b5cf6]
          prose-p:text-[#cbd5e1] prose-p:leading-relaxed
          prose-a:text-[#7c3aed] prose-a:no-underline hover:prose-a:underline
          prose-strong:text-[#a78bfa] prose-code:text-[#06b6d4] prose-code:bg-[#1e1e2a] prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded
          prose-pre:bg-[#0d1117] prose-pre:border prose-pre:border-[#2a2a3a]
          prose-li:text-[#cbd5e1] prose-blockquote:border-[#7c3aed] prose-blockquote:bg-[#1e1e2a]
          prose-table:border prose-table:border-[#2a2a3a] prose-th:bg-[#7c3aed] prose-th:text-white
          prose-td:text-[#cbd5e1] prose-td:border-[#2a2a3a]
          prose-hr:border-[#2a2a3a]">
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            rehypePlugins={[rehypeHighlight]}
          >
            {content}
          </ReactMarkdown>
        </div>
      </div>
    </div>
  );
}
