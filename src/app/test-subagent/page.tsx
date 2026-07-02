'use client';

import React from 'react';

/**
 * 子智能体测试页面
 * 显示"子智能体测试成功 ✅" 大标题，绿色背景卡片样式
 */
export default function TestSubAgentPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <div className="bg-green-500 rounded-2xl shadow-2xl p-10 md:p-16 text-center max-w-2xl w-full">
        <h1 className="text-3xl md:text-5xl font-bold text-white mb-4">
          子智能体测试成功 ✅
        </h1>
        <p className="text-green-100 text-lg md:text-xl">
          页面正常运行，Tailwind CSS 样式生效
        </p>
      </div>
    </div>
  );
}
