"use client";

import { useState } from 'react';
import { MessageSquare, Plus, Download } from 'lucide-react';
import { ModelSelector } from './ModelSelector';

const CHAT_MODES = [
  { id: 'coding', name: '编程', icon: null, color: 'text-violet-400', placeholder: '告诉我你想做什么...' },
  { id: 'writing', name: '文案', icon: null, color: 'text-amber-400', placeholder: '输入你的写作需求...' },
  { id: 'analysis', name: '分析', icon: null, color: 'text-emerald-400', placeholder: '描述你要分析的问题...' },
  { id: 'design', name: '设计', icon: null, color: 'text-pink-400', placeholder: '描述你的设计需求...' },
  { id: 'chat', name: '聊天', icon: null, color: 'text-sky-400', placeholder: '随便聊聊...' },
];

interface TopBarProps {
  showSidebar: boolean;
  onToggleSidebar: () => void;
  selectedModel: string;
  onModelChange: (modelId: string) => void;
  selectedMode: string;
  onModeChange: (modeId: string) => void;
  currentConvId: string | null;
  onNewChat: () => void;
  onExport: () => void;
}

export function TopBar({
  showSidebar,
  onToggleSidebar,
  selectedModel,
  onModelChange,
  selectedMode,
  onModeChange,
  currentConvId,
  onNewChat,
  onExport,
}: TopBarProps) {
  const [showModeMenu, setShowModeMenu] = useState(false);
  const currentMode = CHAT_MODES.find(m => m.id === selectedMode);

  return (
    <div className="border-b border-border px-3 py-2 md:px-4 md:py-3 shrink-0 flex items-center gap-2">
      {/* Sidebar toggle */}
      <button
        onClick={onToggleSidebar}
        className={`p-1.5 rounded-lg transition-colors shrink-0 ${
          showSidebar ? 'bg-muted text-foreground' : 'hover:bg-muted text-muted-foreground'
        }`}
        title="对话历史"
      >
        <MessageSquare className="w-4 h-4" />
      </button>

      {/* Mode Selector */}
      <div className="relative shrink-0">
        <button
          onClick={() => setShowModeMenu(!showModeMenu)}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-border bg-input hover:bg-muted transition-colors text-sm"
        >
          <span className={`w-4 h-4 ${currentMode?.color || ''}`}>
            {/* Icon placeholder */}
          </span>
          <span className="hidden sm:inline">
            {CHAT_MODES.find(m => m.id === selectedMode)?.name}
          </span>
        </button>
        {showModeMenu && (
          <>
            <div className="fixed inset-0 z-20" onClick={() => setShowModeMenu(false)} />
            <div className="absolute top-full left-0 mt-1 z-30 bg-popover border border-border rounded-lg shadow-lg py-1 min-w-[120px]">
              {CHAT_MODES.map(m => (
                <button
                  key={m.id}
                  onClick={() => { onModeChange(m.id); setShowModeMenu(false); }}
                  className={`w-full flex items-center gap-2 px-3 py-2 text-sm text-left transition-colors ${
                    selectedMode === m.id ? 'bg-primary/10 text-primary' : 'hover:bg-muted'
                  }`}
                >
                  <span className={`w-4 h-4 ${m.color}`} />
                  <span>{m.name}</span>
                </button>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Model Selector */}
      <div className="relative flex-1 max-w-full">
        <ModelSelector
          selectedModel={selectedModel}
          onModelChange={onModelChange}
        />
      </div>

      {/* Actions when conversation exists */}
      {currentConvId && (
        <>
          <button
            onClick={onExport}
            className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground transition-colors shrink-0"
            title="导出对话"
          >
            <Download className="w-4 h-4" />
          </button>
          <button
            onClick={onNewChat}
            className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground transition-colors shrink-0"
            title="新建对话"
          >
            <Plus className="w-4 h-4" />
          </button>
        </>
      )}
    </div>
  );
}

export { CHAT_MODES };
