"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";

export default function ReportViewPage() {
  const params = useParams();
  const id = params.id as string;
  const [content, setContent] = useState<string>("");
  const [title, setTitle] = useState("报告加载中...");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const loadReport = async () => {
      try {
        const res = await fetch("/api/artifacts/" + id);
        if (res.ok) {
          const data = await res.json();
          if (data.content) {
            // Clean up any markers
            let c = data.content;
            c = c.replace(/<!--EXEC_LOG[\s\S]*?-->/g, "");
            c = c.replace(/<!--REPORT_CARD[\s\S]*?-->/g, "");
            c = c.replace(/<!--FULL_REPORT-->/g, "").replace(/<!--\/FULL_REPORT-->/g, "");
            c = c.replace(/<!--HTML_PREVIEW[\s\S]*?-->/g, "");
            setContent(c.trim());
            setTitle(data.title || "分析报告");
          } else {
            setError("报告内容为空");
          }
        } else {
          setError("报告未找到 (404)");
        }
      } catch (e) {
        setError("加载失败: " + String(e));
      } finally {
        setLoading(false);
      }
    };
    if (id) loadReport();
  }, [id]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0f0f14] flex items-center justify-center">
        <div className="text-gray-400 text-lg animate-pulse">加载报告中...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-[#0f0f14] flex items-center justify-center">
        <div className="text-red-400 text-lg">{error}</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0f0f14]">
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-xl font-bold text-white">{title}</h1>
          <a
            href={`/api/artifacts/${id}/download`}
            className="text-sm text-[#7c3aed] hover:text-[#9b5de5] flex items-center gap-1"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            下载
          </a>
        </div>
        <div className="prose prose-invert prose-sm max-w-none
          prose-headings:text-white prose-headings:font-semibold
          prose-h1:text-2xl prose-h2:text-xl prose-h3:text-lg
          prose-p:text-gray-300 prose-a:text-[#7c3aed] prose-a:no-underline hover:prose-a:underline
          prose-strong:text-white prose-code:text-[#7c3aed]
          prose-pre:bg-[#1a1a2e] prose-pre:border prose-pre:border-gray-700/50
          prose-li:text-gray-300 prose-table:border prose-table:border-gray-700
          prose-th:bg-[#1a1a2e] prose-th:text-white prose-td:text-gray-300
          prose-blockquote:border-[#7c3aed] prose-blockquote:text-gray-400
          prose-hr:border-gray-700">
          <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeHighlight]}>
            {content}
          </ReactMarkdown>
        </div>
      </div>
    </div>
  );
}
