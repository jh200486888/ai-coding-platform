// @ts-nocheck
'use client';
import { useState, useEffect } from 'react';
import { Shield, Save, RefreshCw, AlertTriangle, Plus, X, RotateCcw } from 'lucide-react';
import { toast } from 'sonner';

const DEFAULT_PATTERNS = [
  'rm\\s+(-[a-zA-Z]*[rf][a-zA-Z]*\\s+)*\\/(etc|usr|bin|sbin|lib|boot|dev|proc|sys)',
  'dd\\b.*\\bof=\\/dev\\/',
  'mkfs',
  'format',
  'chmod\\s+777',
  'shutdown',
  'reboot',
  'curl\\b.*\\|\\s*(bash|sh|zsh)',
  'wget\\b.*\\|\\s*(bash|sh|zsh)',
  'nc\\b.*\\s+-[a-zA-Z]*[lep]',
  'ncat\\b.*\\s+-[a-zA-Z]*[lep]',
  ':(){ :\\|:& };:',
  '>\\/dev\\/sda',
  '>\\/dev\\/nvme',
  'passwd',
  'useradd',
  'userdel',
  'iptables\\s+-F',
  'kill\\s+-9\\s+1',
  'socat\\b.*\\bEXEC\\b',
];

export function SecurityConfigPanel() {
  const [dangerousPatterns, setDangerousPatterns] = useState<string[]>([...DEFAULT_PATTERNS]);
  const [savedPatterns, setSavedPatterns] = useState<string[]>([...DEFAULT_PATTERNS]);
  const [newPattern, setNewPattern] = useState('');
  const [rateLimitConfig, setRateLimitConfig] = useState({
    max_requests_per_minute: 30,
    max_requests_per_hour: 200,
    block_duration_ms: 60000,
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchConfig();
  }, []);

  const fetchConfig = async () => {
    try {
      const res = await fetch('/api/admin/settings');
      const data = await res.json();
      if (data.success && data.data) {
        if (data.data.security_config) {
          try {
            const sc = JSON.parse(data.data.security_config);
            if (sc.dangerous_patterns && sc.dangerous_patterns.length > 0) {
              setDangerousPatterns(sc.dangerous_patterns);
              setSavedPatterns(sc.dangerous_patterns);
            }
          } catch {}
        }
        if (data.data.rate_limit_config) {
          try {
            const rl = JSON.parse(data.data.rate_limit_config);
            setRateLimitConfig(prev => ({ ...prev, ...rl }));
          } catch {}
        }
        if (data.data.advanced_config) {
          try {
            const adv = JSON.parse(data.data.advanced_config);
            if (adv.rate_limit_per_minute) {
              setRateLimitConfig(prev => ({
                ...prev,
                max_requests_per_minute: adv.rate_limit_per_minute || prev.max_requests_per_minute,
                max_requests_per_hour: adv.rate_limit_per_hour || prev.max_requests_per_hour,
              }));
            }
          } catch {}
        }
      }
    } catch (e) { console.error('Failed to fetch security config:', e); }
  };

  const handleSave = async () => {
    setLoading(true);
    try {
      await Promise.all([
        fetch('/api/admin/settings', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ key: 'security_config', value: JSON.stringify({ dangerous_patterns: dangerousPatterns }) }),
        }),
        fetch('/api/admin/settings', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ key: 'rate_limit_config', value: JSON.stringify(rateLimitConfig) }),
        }),
      ]);
      setSavedPatterns([...dangerousPatterns]);
      toast.success('安全配置已保存');
    } catch (e) {
      toast.error('保存失败');
    }
    setLoading(false);
  };

  const handleRestoreDefaults = () => {
    setDangerousPatterns([...DEFAULT_PATTERNS]);
    toast.success('已恢复默认黑名单（' + DEFAULT_PATTERNS.length + ' 条），点击保存生效');
  };

  const handleUndoDelete = () => {
    // Find patterns in savedPatterns that are missing from dangerousPatterns
    const missing = savedPatterns.filter(p => !dangerousPatterns.includes(p));
    if (missing.length > 0) {
      setDangerousPatterns([...dangerousPatterns, ...missing]);
      toast.success('已恢复 ' + missing.length + ' 条被删除的模式，点击保存生效');
    } else {
      toast.info('没有检测到被删除的模式');
    }
  };

  const addPattern = () => {
    if (newPattern.trim() && !dangerousPatterns.includes(newPattern.trim())) {
      setDangerousPatterns([...dangerousPatterns, newPattern.trim()]);
      setNewPattern('');
    }
  };

  const removePattern = (idx: number) => {
    setDangerousPatterns(dangerousPatterns.filter((_, i) => i !== idx));
  };

  const hasUnsavedChanges = JSON.stringify(dangerousPatterns) !== JSON.stringify(savedPatterns);
  const missingCount = savedPatterns.filter(p => !dangerousPatterns.includes(p)).length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <Shield size={20} /> 安全配置
        </h2>
        <button onClick={handleSave} disabled={loading}
          className="flex items-center gap-1 px-4 py-1.5 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 text-sm">
          <Save size={14} /> {loading ? '保存中...' : '保存配置'}
        </button>
      </div>

      {/* Rate Limiting */}
      <div className="rounded-lg border border-border p-4 space-y-4">
        <h3 className="font-medium flex items-center gap-2">
          <AlertTriangle size={16} className="text-yellow-500" /> 速率限制
        </h3>
        <p className="text-sm text-muted-foreground">限制每个用户的请求频率，防止滥用。</p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="text-sm text-muted-foreground block mb-1">每分钟最大请求数</label>
            <input type="number" value={rateLimitConfig.max_requests_per_minute}
              onChange={e => setRateLimitConfig(prev => ({ ...prev, max_requests_per_minute: parseInt(e.target.value) || 30 }))}
              className="w-full px-3 py-1.5 rounded-lg border border-border bg-background text-sm" />
          </div>
          <div>
            <label className="text-sm text-muted-foreground block mb-1">每小时最大请求数</label>
            <input type="number" value={rateLimitConfig.max_requests_per_hour}
              onChange={e => setRateLimitConfig(prev => ({ ...prev, max_requests_per_hour: parseInt(e.target.value) || 200 }))}
              className="w-full px-3 py-1.5 rounded-lg border border-border bg-background text-sm" />
          </div>
          <div>
            <label className="text-sm text-muted-foreground block mb-1">超限封禁时长(毫秒)</label>
            <input type="number" value={rateLimitConfig.block_duration_ms}
              onChange={e => setRateLimitConfig(prev => ({ ...prev, block_duration_ms: parseInt(e.target.value) || 60000 }))}
              className="w-full px-3 py-1.5 rounded-lg border border-border bg-background text-sm" />
          </div>
        </div>
      </div>

      {/* Dangerous Command Patterns */}
      <div className="rounded-lg border border-border p-4 space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <h3 className="font-medium flex items-center gap-2">
            <Shield size={16} className="text-red-500" /> 危险命令黑名单
            <span className="text-xs text-muted-foreground font-normal">({dangerousPatterns.length} 条)</span>
          </h3>
          <div className="flex gap-2">
            {missingCount > 0 && (
              <button onClick={handleUndoDelete}
                className="px-3 py-1 rounded-lg bg-yellow-500/10 text-yellow-600 hover:bg-yellow-500/20 text-xs flex items-center gap-1">
                <RotateCcw size={12} /> 恢复被删除的 ({missingCount})
              </button>
            )}
            <button onClick={handleRestoreDefaults}
              className="px-3 py-1 rounded-lg bg-blue-500/10 text-blue-600 hover:bg-blue-500/20 text-xs flex items-center gap-1">
              <RotateCcw size={12} /> 恢复全部默认
            </button>
          </div>
        </div>
        <p className="text-sm text-muted-foreground">
          以下正则模式用于拦截危险命令。匹配到的命令将被阻止执行。删除后点"恢复被删除的"可找回。
        </p>
        
        {/* Add new pattern */}
        <div className="flex gap-2">
          <input value={newPattern} onChange={e => setNewPattern(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && addPattern()}
            placeholder="添加危险命令模式 (正则表达式)..."
            className="flex-1 px-3 py-1.5 rounded-lg border border-border bg-background text-sm font-mono" />
          <button onClick={addPattern}
            className="px-3 py-1.5 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 text-sm flex items-center gap-1">
            <Plus size={14} /> 添加
          </button>
        </div>

        {/* Pattern list */}
        <div className="flex flex-wrap gap-2">
          {dangerousPatterns.map((pattern, idx) => (
            <span key={idx} className="inline-flex items-center gap-1 px-2 py-1 rounded bg-red-500/10 text-red-600 dark:text-red-400 text-xs font-mono">
              {pattern}
              <button onClick={() => removePattern(idx)} className="hover:text-red-800" title="删除">
                <X size={12} />
              </button>
            </span>
          ))}
        </div>

        {hasUnsavedChanges && (
          <p className="text-xs text-yellow-500">有未保存的更改，点击"保存配置"生效</p>
        )}
      </div>
    </div>
  );
}
