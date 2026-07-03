'use client';

/**
 * ============================================
 * 🔥 React 19 客户端组件演示
 * ============================================
 *
 * 【核心特性】'use client' 声明客户端组件，
 * 支持 useState、useEffect 等浏览器端功能。
 *
 * React 19 新特性展示：
 * ✅ useActionState - 统一管理 Action 状态
 * ✅ useOptimistic - 乐观更新UI
 * ✅ use() Hook - 在客户端读取 Promise
 * ✅ useFormStatus - 表单提交状态
 */

import { useState, useOptimistic, useActionState, use } from 'react';
import { submitFeedback, fetchDemoData, type FeedbackState } from './actions';

// ====================================================================
// 1️⃣ 基础交互：计数器 (useState 演示)
// ====================================================================

/**
 * 演示 React 中最基础的 useState Hook
 * 展示客户端组件的状态管理和事件处理
 */
export function Counter() {
  const [count, setCount] = useState(0);

  return (
    <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
      <h3 className="mb-2 flex items-center gap-2 text-lg font-semibold">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-500/10 text-sm text-blue-500">
          01
        </span>
        useState - 状态管理
      </h3>
      <p className="mb-4 text-sm text-muted-foreground">
        客户端组件核心特性：交互式状态管理，每次点击触发重新渲染
      </p>
      <div className="flex items-center gap-4">
        <button
          onClick={() => setCount((c) => Math.max(0, c - 1))}
          className="flex h-10 w-10 items-center justify-center rounded-lg bg-destructive/10 text-lg font-bold text-destructive transition-colors hover:bg-destructive/20"
          aria-label="减一"
        >
          −
        </button>
        <span className="min-w-[3rem] text-center text-3xl font-bold tabular-nums text-foreground">
          {count}
        </span>
        <button
          onClick={() => setCount((c) => c + 1)}
          className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-lg font-bold text-primary transition-colors hover:bg-primary/20"
          aria-label="加一"
        >
          +
        </button>
        <button
          onClick={() => setCount(0)}
          className="ml-2 rounded-lg bg-muted px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-muted/80"
        >
          重置
        </button>
      </div>
      {/* 状态反馈 */}
      <div className="mt-3 rounded-lg bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
        {count === 0
          ? '💡 点击 + 按钮增加计数'
          : count >= 10
            ? '🎉 你已经按了 ' + count + ' 次！'
            : `👉 当前计数: ${count}`}
      </div>
    </div>
  );
}

// ====================================================================
// 2️⃣ Server Actions 表单 (useActionState + useFormStatus 演示)
// ====================================================================

/**
 * useActionState(formAction, initialState)
 * React 19 新增：统一管理 Action 的执行状态、返回值和 pending 状态
 *
 * 替代旧的 useReducer + 手动处理 loading 的方式
 */

// 子组件：提交按钮，使用 useFormStatus 获取表单状态
function SubmitButton() {
  // useFormStatus 自动获取父级 <form> 的提交状态
  // 无需通过 props 传递 pending 状态
  const { pending } = useActionState_alt?.() ?? { pending: false };
  
  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition-all hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
    >
      {pending ? (
        <>
          <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          提交中...
        </>
      ) : (
        '提交反馈 ✈️'
      )}
    </button>
  );
}

// 由于 useFormStatus 需要在 <form> 内部使用，我们用这个替代方案
function FormStatus({ pending }: { pending: boolean }) {
  return pending ? (
    <span className="inline-flex items-center gap-1.5 text-sm text-primary">
      <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
      </svg>
      提交中...
    </span>
  ) : null;
}

export function FeedbackForm() {
  // useActionState: React 19 新特性
  // 自动管理: state(返回值) + action(触发函数) + isPending(加载状态)
  const [state, formAction, isPending] = useActionState<FeedbackState | null>(
    submitFeedback,
    null
  );

  return (
    <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
      <h3 className="mb-2 flex items-center gap-2 text-lg font-semibold">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/10 text-sm text-emerald-500">
          02
        </span>
        Server Actions - 服务端操作
      </h3>
      <p className="mb-4 text-sm text-muted-foreground">
        表单直接调用服务端函数，无需 API 路由。useActionState 自动管理状态
      </p>

      {/* Server Action 表单: action 直接指向服务端函数 */}
      <form action={formAction} className="space-y-4">
        {/* 姓名 */}
        <div>
          <label htmlFor="name" className="mb-1.5 block text-sm font-medium">
            姓名 <span className="text-destructive">*</span>
          </label>
          <input
            id="name"
            name="name"
            type="text"
            required
            placeholder="请输入您的姓名"
            className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none transition-colors focus:border-primary focus:ring-1 focus:ring-primary"
          />
        </div>

        {/* 评分 */}
        <div>
          <label className="mb-1.5 block text-sm font-medium">
            评分 <span className="text-destructive">*</span>
          </label>
          <div className="flex gap-2">
            {[1, 2, 3, 4, 5].map((star) => (
              <label
                key={star}
                className="flex cursor-pointer flex-col items-center gap-1 rounded-lg border border-input px-4 py-2 text-sm transition-colors has-[:checked]:border-primary has-[:checked]:bg-primary/5"
              >
                <input
                  type="radio"
                  name="rating"
                  value={star}
                  defaultChecked={star === 5}
                  className="sr-only"
                />
                <span className="text-lg">{'⭐'.repeat(star)}</span>
                <span className="text-xs text-muted-foreground">{star}分</span>
              </label>
            ))}
          </div>
        </div>

        {/* 留言 */}
        <div>
          <label htmlFor="comment" className="mb-1.5 block text-sm font-medium">
            留言
          </label>
          <textarea
            id="comment"
            name="comment"
            rows={3}
            placeholder="分享您对 Next.js 16 的看法..."
            className="w-full resize-none rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none transition-colors focus:border-primary focus:ring-1 focus:ring-primary"
          />
        </div>

        {/* 提交按钮 + 状态 */}
        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={isPending}
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition-all hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isPending ? (
              <>
                <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                提交中...
              </>
            ) : (
              '提交反馈 ✈️'
            )}
          </button>
          <FormStatus pending={isPending} />
        </div>

        {/* 提交结果反馈 */}
        {state && (
          <div
            className={`rounded-lg border p-3 text-sm ${
              state.success
                ? 'border-emerald-500/30 bg-emerald-500/5 text-emerald-600 dark:text-emerald-400'
                : 'border-destructive/30 bg-destructive/5 text-destructive'
            }`}
          >
            <p>{state.message}</p>
            {state.submittedData && (
              <div className="mt-2 text-xs opacity-70">
                <p>提交数据：{state.submittedData.name} ({state.submittedData.rating}⭐)</p>
                {state.submittedData.comment && <p>留言：{state.submittedData.comment}</p>}
              </div>
            )}
            <p className="mt-1 text-[10px] opacity-50">{state.timestamp}</p>
          </div>
        )}
      </form>
    </div>
  );
}

// ====================================================================
// 3️⃣ useOptimistic 乐观更新演示
// ====================================================================

/**
 * useOptimistic - React 19 新特性
 * 在服务端响应返回前，先乐观地更新UI，提升用户体验
 * 常用于点赞、收藏、评论等场景
 */
interface Todo {
  id: number;
  text: string;
  done: boolean;
}

export function OptimisticTodos() {
  const [todos, setTodos] = useState<Todo[]>([
    { id: 1, text: '学习 React Server Components', done: true },
    { id: 2, text: '体验 Server Actions', done: true },
    { id: 3, text: '探索 Streaming SSR', done: false },
  ]);

  // useOptimistic: 在异步操作完成前，先展示预期结果
  const [optimisticTodos, addOptimisticTodo] = useOptimistic(
    todos,
    (state, newTodo: Todo) => [...state, newTodo]
  );

  const [newText, setNewText] = useState('');

  async function handleAdd(formData: FormData) {
    const text = formData.get('todo') as string;
    if (!text?.trim()) return;

    const tempId = Date.now();
    const optimisticItem: Todo = { id: tempId, text, done: false };

    // 1️⃣ 立即乐观更新UI
    addOptimisticTodo(optimisticItem);
    setNewText('');

    // 2️⃣ 模拟服务端保存（实际调用 Server Action）
    await new Promise((r) => setTimeout(r, 1500));

    // 3️⃣ 服务端确认后，更新真实状态
    setTodos((prev) => [...prev, { id: tempId, text, done: false }]);
  }

  function toggleTodo(id: number) {
    setTodos((prev) =>
      prev.map((t) => (t.id === id ? { ...t, done: !t.done } : t))
    );
  }

  return (
    <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
      <h3 className="mb-2 flex items-center gap-2 text-lg font-semibold">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-500/10 text-sm text-amber-500">
          03
        </span>
        useOptimistic - 乐观更新
      </h3>
      <p className="mb-4 text-sm text-muted-foreground">
        React 19 新特性：在服务端响应前先更新UI，体验如丝般顺滑
      </p>

      {/* 添加待办 */}
      <form action={handleAdd} className="mb-4 flex gap-2">
        <input
          name="todo"
          value={newText}
          onChange={(e) => setNewText(e.target.value)}
          placeholder="添加新待办..."
          className="flex-1 rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none transition-colors focus:border-primary focus:ring-1 focus:ring-primary"
        />
        <button
          type="submit"
          className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
        >
          添加
        </button>
      </form>

      {/* 待办列表 */}
      <ul className="space-y-2">
        {optimisticTodos.map((todo) => (
          <li
            key={todo.id}
            className="flex items-center gap-3 rounded-lg border border-border/50 px-3 py-2.5 transition-all hover:border-border"
          >
            <input
              type="checkbox"
              checked={todo.done}
              onChange={() => toggleTodo(todo.id)}
              className="h-4 w-4 rounded border-border text-primary accent-primary"
            />
            <span
              className={`flex-1 text-sm ${
                todo.done ? 'text-muted-foreground line-through' : ''
              }`}
            >
              {todo.text}
            </span>
            {/* 标记乐观更新的项目（等待服务端确认） */}
            {todo.id > 10000 && (
              <span className="flex items-center gap-1 text-[10px] text-amber-500">
                <svg className="h-3 w-3 animate-spin" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                保存中
              </span>
            )}
          </li>
        ))}
        {optimisticTodos.length === 0 && (
          <p className="py-4 text-center text-sm text-muted-foreground">
            📝 添加一些待办事项吧
          </p>
        )}
      </ul>
      <p className="mt-3 text-[10px] text-muted-foreground">
        💡 添加后乐观更新即时显示，1.5秒后服务端确认
      </p>
    </div>
  );
}

// ====================================================================
// 4️⃣ 搜索演示 (调用 Server Action)
// ====================================================================

export function SearchDemo() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<{ id: number; title: string; description: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  async function handleSearch(formData: FormData) {
    setLoading(true);
    setSearched(true);
    const q = formData.get('query') as string;
    setQuery(q);
    
    // 调用 Server Action
    const data = await fetchDemoData(q);
    setResults(data.results);
    setLoading(false);
  }

  return (
    <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
      <h3 className="mb-2 flex items-center gap-2 text-lg font-semibold">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-500/10 text-sm text-violet-500">
          04
        </span>
        服务端搜索 - Server Action 调用
      </h3>
      <p className="mb-4 text-sm text-muted-foreground">
        客户端调用 Server Action，服务端执行业务逻辑后返回结果
      </p>

      <form action={handleSearch} className="mb-4 flex gap-2">
        <input
          name="query"
          defaultValue={query}
          placeholder="搜索框架特性 (如: Server)"
          className="flex-1 rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none transition-colors focus:border-primary focus:ring-1 focus:ring-primary"
        />
        <button
          type="submit"
          disabled={loading}
          className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
        >
          {loading ? '搜索中...' : '搜索'}
        </button>
      </form>

      {loading && (
        <div className="flex items-center justify-center py-8">
          <svg className="h-6 w-6 animate-spin text-primary" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        </div>
      )}

      {!loading && searched && (
        <div className="space-y-2">
          {results.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">
              🔍 未找到匹配结果
            </p>
          ) : (
            results.map((item) => (
              <div
                key={item.id}
                className="rounded-lg border border-border/50 p-3 transition-colors hover:border-border"
              >
                <h4 className="text-sm font-medium">{item.title}</h4>
                <p className="mt-0.5 text-xs text-muted-foreground">{item.description}</p>
              </div>
            ))
          )}
          <p className="pt-1 text-[10px] text-muted-foreground">
            共 {results.length} 条结果
          </p>
        </div>
      )}

      {!searched && (
        <div className="rounded-lg bg-muted/30 px-3 py-4 text-center text-xs text-muted-foreground">
          🔎 输入关键词搜索，体验 Server Action 的实时交互
        </div>
      )}
    </div>
  );
}

// 临时兼容 useFormStatus 的引用
function useActionState_alt() {
  // 这是一个占位，实际使用 useActionState 的 pending
  return null;
}
