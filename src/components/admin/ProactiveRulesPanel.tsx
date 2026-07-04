'use client';
import { useState, useEffect, useCallback } from 'react';
import { Save, RotateCcw, Brain, Zap, Shield, Search, Lightbulb, Archive } from 'lucide-react';

const DEFAULT_RULES = `【主动推理规则】
你是一个具备主动推理能力的AI助手。除了完成用户的直接请求外，你还应该：

1. 验证意识：执行写操作（创建文件、修改代码）后，主动建议验证操作结果（构建检查、运行测试）
2. 风险预警：执行危险操作前，主动提醒备份和风险。执行后确认影响范围
3. 步骤补全：如果用户的请求遗漏了关键步骤（如部署后不检查），主动补充执行
4. 模式识别：如果连续多次使用同一工具失败，主动换一种方法而不是重复尝试
5. 流程沉淀：完成复杂任务后，建议将成功经验保存为技能（save_learned_skill）
6. 进度提醒：如果已经收集了足够信息但还没有开始行动，主动开始执行

注意：主动建议应该是简短的提示，不要长篇大论。每次最多提2条建议。`;

const RULE_ICONS: Record<string, any> = {
  '验证意识': Shield,
  '风险预警': Zap,
  '步骤补全': Search,
  '模式识别': Brain,
  '流程沉淀': Archive,
  '进度提醒': Lightbulb,
};

export default function ProactiveRulesPanel() {
  const [rules, setRules] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [message, setMessage] = useState('');
  const [enabled, setEnabled] = useState(true);

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/platform-config?key=proactive_rules');
      const data = await res.json();
      if (data.value) setRules(data.value);
      else setRules(DEFAULT_RULES);
      // Check enabled flag
      const res2 = await fetch('/api/admin/platform-config?key=proactive_enabled');
      const data2 = await res2.json();
      if (data2.value) setEnabled(data2.value === 'true');
    } catch {} finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/admin/platform-config', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: 'proactive_rules', value: rules }),
      });
      if (!res.ok) { setMessage('保存失败'); return; }
      await fetch('/api/admin/platform-config', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: 'proactive_enabled', value: String(enabled) }),
      });
      setDirty(false);
      setMessage('✅ 已保存');
      setTimeout(() => setMessage(''), 2000);
    } finally { setSaving(false); }
  };

  const handleReset = () => {
    if (!confirm('恢复默认规则？')) return;
    setRules(DEFAULT_RULES);
    setDirty(true);
  };

  // Parse rules into individual items for display
  const ruleItems = rules.split('\n').filter(l => /^\d+\./.test(l.trim()));

  if (loading) return <div className="p-6 text-sm text-muted-foreground">加载中...</div>;

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold flex items-center gap-2"><Brain size={16} /> 主动推理规则管理</h3>
          <p className="text-xs text-muted-foreground mt-1">
            控制AI助手在完成任务时的主动推理行为。这些规则会注入到系统提示中，影响Agent的决策模式。
          </p>
        </div>
        <div className="flex items-center gap-2">
          {message && <span className="text-xs text-green-600">{message}</span>}
          {dirty && <span className="text-xs text-orange-500">● 未保存</span>}
          <button onClick={handleReset} className="px-3 py-1.5 text-xs border rounded-md hover:bg-muted">
            <RotateCcw size={12} className="inline mr-1" />恢复默认
          </button>
          <button onClick={handleSave} disabled={!dirty || saving} className="px-3 py-1.5 text-xs bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50">
            <Save size={12} className="inline mr-1" />保存
          </button>
        </div>
      </div>

      {/* Enable/Disable toggle */}
      <div className="flex items-center gap-3 p-3 border rounded-lg">
        <input type="checkbox" checked={enabled} onChange={e => { setEnabled(e.target.checked); setDirty(true); }} className="w-4 h-4" id="proactive-enabled" />
        <label htmlFor="proactive-enabled" className="text-sm font-medium">启用主动推理</label>
        <span className="text-xs text-muted-foreground">关闭后AI将仅响应用户直接请求，不会主动建议或提醒</span>
      </div>

      {/* Rule preview cards */}
      <div className="grid grid-cols-2 gap-2">
        {ruleItems.map((item, idx) => {
          const keyword = item.match(/[^\d.：:]+/)?.[0]?.trim() || '';
          const Icon = Object.entries(RULE_ICONS).find(([k]) => item.includes(k))?.[1] || Brain;
          return (
            <div key={idx} className="flex items-start gap-2 p-2.5 border rounded-lg bg-muted/30">
              <Icon size={14} className="text-primary mt-0.5 shrink-0" />
              <div className="text-xs text-foreground leading-relaxed">{item.replace(/^\d+\.\s*/, '')}</div>
            </div>
          );
        })}
      </div>

      {/* Full editor */}
      <div>
        <label className="text-xs text-muted-foreground mb-1 block">规则全文编辑</label>
        <textarea
          value={rules}
          onChange={e => { setRules(e.target.value); setDirty(true); }}
          rows={14}
          className="w-full text-xs font-mono px-3 py-2 border rounded-lg bg-background resize-y focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <div className="text-xs text-muted-foreground mt-1">{rules.length} 字符 · {ruleItems.length} 条规则</div>
      </div>
    </div>
  );
}
