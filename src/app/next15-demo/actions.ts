'use server';

/**
 * ============================================
 * 🔥 Next.js 16 Server Actions 演示
 * ============================================
 *
 * 【核心特性】Server Actions 允许客户端直接调用服务端函数，
 * 无需手动创建 API 路由。数据突变、表单处理更简洁。
 *
 * 优势：
 * ✅ 类型安全 - 客户端/服务端共享类型
 * ✅ 渐进增强 - 无JS时通过表单提交回退
 * ✅ 内置安全 - CSRF 自动防护
 * ✅ 流式响应 - 支持渐进式加载
 *
 * 使用方式：
 *   <form action={myAction}>...</form>
 *   或 const result = await myAction(data)
 */

// 定义反馈类型
export interface FeedbackState {
  success: boolean;
  message: string;
  timestamp: string;
  submittedData?: {
    name: string;
    rating: number;
    comment: string;
  };
}

/**
 * 提交反馈 - Server Action 示例
 * 演示：表单处理、数据验证、错误处理
 */
export async function submitFeedback(
  prevState: FeedbackState | null,
  formData: FormData
): Promise<FeedbackState> {
  // 模拟延迟，展示加载状态
  await new Promise((resolve) => setTimeout(resolve, 1000));

  // 获取表单数据
  const name = formData.get('name') as string;
  const rating = parseInt(formData.get('rating') as string, 10);
  const comment = formData.get('comment') as string;

  // 数据验证
  if (!name || name.trim().length < 2) {
    return {
      success: false,
      message: '❌ 姓名至少需要2个字符',
      timestamp: new Date().toLocaleString('zh-CN'),
    };
  }

  if (isNaN(rating) || rating < 1 || rating > 5) {
    return {
      success: false,
      message: '❌ 请选择1-5分的评分',
      timestamp: new Date().toLocaleString('zh-CN'),
    };
  }

  // 模拟保存到数据库
  console.log(`[Server Action] 收到反馈: ${name}, 评分: ${rating}, 留言: ${comment}`);

  return {
    success: true,
    message: `✅ ${name}，感谢您的反馈！`,
    timestamp: new Date().toLocaleString('zh-CN'),
    submittedData: { name, rating, comment },
  };
}

/**
 * 模拟API数据获取 - Server Action 示例
 * 演示：服务端直接调用第三方API，客户端无需知道API密钥
 */
export async function fetchDemoData(query: string): Promise<{
  results: { id: number; title: string; description: string }[];
  query: string;
}> {
  'use server';
  
  // 模拟搜索逻辑（实际可调用数据库或外部API）
  const demoData = [
    { id: 1, title: 'React Server Components', description: '服务端渲染组件，减少客户端JS体积，直接访问后端资源' },
    { id: 2, title: 'Server Actions', description: '服务端操作函数，表单提交和数据突变的一体化方案' },
    { id: 3, title: 'App Router', description: '基于文件系统的路由系统，支持嵌套布局、加载态和错误处理' },
    { id: 4, title: 'Streaming SSR', description: '流式服务端渲染，页面内容可分块渐进式加载' },
    { id: 5, title: 'React 19 use()', description: '直接在组件中await Promise，简化异步数据处理' },
  ];

  await new Promise((r) => setTimeout(r, 500));

  const filtered = query
    ? demoData.filter(
        (item) =>
          item.title.toLowerCase().includes(query.toLowerCase()) ||
          item.description.includes(query)
      )
    : demoData;

  return { results: filtered, query };
}
