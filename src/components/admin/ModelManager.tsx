'use client';

import { useState, useEffect } from 'react';
import { Plus, Trash2, Settings } from 'lucide-react';
import type { ModelConfig } from '@/types';
import { MODELS, PROVIDERS } from '@/lib/models';

export function ModelManager() {
  const [models, setModels] = useState<ModelConfig[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [newModel, setNewModel] = useState<Partial<ModelConfig>>({
    name: '',
    provider: 'openai',
    modelId: '',
    isActive: true,
  });

  useEffect(() => {
    fetchModels();
  }, []);

  const fetchModels = async () => {
    const response = await fetch('/api/models');
    if (response.ok) {
      const data = await response.json();
      setModels(data);
    }
  };

  const handleAdd = async () => {
    const response = await fetch('/api/models', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newModel),
    });
    if (response.ok) {
      setShowForm(false);
      setNewModel({
        name: '',
        provider: 'openai',
        modelId: '',
        isActive: true,
      });
      fetchModels();
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('确定要删除这个模型吗？')) return;
    const response = await fetch(`/api/models?id=${id}`, {
      method: 'DELETE',
    });
    if (response.ok) {
      fetchModels();
    }
  };

  const providers = PROVIDERS;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-white">模型管理</h2>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
        >
          <Plus className="w-4 h-4" />
          添加模型
        </button>
      </div>

      {showForm && (
        <div className="p-4 bg-zinc-800 rounded-lg space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-zinc-400 mb-1">厂商</label>
              <select
                value={newModel.provider}
                onChange={(e) => {
                  const provider = providers.find(p => p.id === e.target.value);
                  setNewModel({
                    ...newModel,
                    provider: e.target.value,
                    modelId: provider?.models[0]?.id || '',
                  });
                }}
                className="w-full px-3 py-2 bg-zinc-700 border border-zinc-600 rounded-lg text-white"
              >
                {providers.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm text-zinc-400 mb-1">模型</label>
              <select
                value={newModel.modelId}
                onChange={(e) => setNewModel({ ...newModel, modelId: e.target.value, name: e.target.options[e.target.selectedIndex].text })}
                className="w-full px-3 py-2 bg-zinc-700 border border-zinc-600 rounded-lg text-white"
              >
                {providers
                  .find((p) => p.id === newModel.provider)
                  ?.models.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                    </option>
                  ))}
              </select>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleAdd}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
            >
              保存
            </button>
            <button
              onClick={() => setShowForm(false)}
              className="px-4 py-2 bg-zinc-700 hover:bg-zinc-600 text-white rounded-lg transition-colors"
            >
              取消
            </button>
          </div>
        </div>
      )}

      <div className="space-y-2">
        {models.map((model) => (
          <div
            key={model.id}
            className="flex items-center justify-between p-4 bg-zinc-800 rounded-lg"
          >
            <div>
              <div className="font-medium text-white">{model.name || model.modelId}</div>
              <div className="text-sm text-zinc-400">
                {model.provider} · {model.modelId}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span
                className={`px-2 py-1 text-xs rounded ${
                  model.isActive
                    ? 'bg-green-500/20 text-green-400'
                    : 'bg-zinc-700 text-zinc-400'
                }`}
              >
                {model.isActive ? '启用' : '禁用'}
              </span>
              <button
                onClick={() => handleDelete(model.id)}
                className="p-2 text-red-400 hover:bg-red-500/20 rounded-lg transition-colors"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        ))}
        {models.length === 0 && (
          <div className="text-center py-8 text-zinc-500">
            暂无模型配置
          </div>
        )}
      </div>
    </div>
  );
}
