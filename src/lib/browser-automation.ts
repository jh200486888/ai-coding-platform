// @ts-nocheck
/**
 * 浏览器自动化工具 - 基于Playwright
 * 支持：打开网页、截图、点击、填写表单、提取数据、执行JS
 */
import { tool } from 'ai';
import { z } from 'zod';
import { chromium, Browser, BrowserContext, Page } from 'playwright';

// 浏览器实例管理（单例+超时自动关闭）
let browserInstance: Browser | null = null;
let browserLastUsed = 0;
const BROWSER_IDLE_TIMEOUT = 5 * 60 * 1000; // 5分钟无操作自动关闭

// 页面缓存（session -> page映射）
const pageCache = new Map<string, { page: Page; lastUsed: number }>();

async function getBrowser(): Promise<Browser> {
  const now = Date.now();
  
  // 清理超时页面
  for (const [key, val] of pageCache.entries()) {
    if (now - val.lastUsed > BROWSER_IDLE_TIMEOUT) {
      try { await val.page.close(); } catch(e) {}
      pageCache.delete(key);
    }
  }
  
  if (browserInstance && browserInstance.isConnected()) {
    browserLastUsed = now;
    return browserInstance;
  }
  
  // 启动新浏览器
  browserInstance = await chromium.launch({
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
      '--single-process',
      '--no-zygote',
    ],
  });
  
  browserLastUsed = now;
  
  // 设置自动关闭
  const checkInterval = setInterval(async () => {
    if (Date.now() - browserLastUsed > BROWSER_IDLE_TIMEOUT) {
      try { await browserInstance?.close(); } catch(e) {}
      browserInstance = null;
      clearInterval(checkInterval);
    }
  }, 60 * 1000);
  
  return browserInstance;
}

async function getPage(sessionId: string): Promise<Page> {
  const now = Date.now();
  const cached = pageCache.get(sessionId);
  
  if (cached && !cached.page.isClosed()) {
    cached.lastUsed = now;
    return cached.page;
  }
  
  const browser = await getBrowser();
  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 },
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    locale: 'zh-CN',
  });
  
  const page = await context.newPage();
  pageCache.set(sessionId, { page, lastUsed: now });
  
  return page;
}

// 截图保存到临时目录
const SCREENSHOT_DIR = '/tmp/ai-browser-screenshots';

/**
 * browser_navigate - 打开网页
 */
export const browserNavigateTool = tool({
  description: `用浏览器打开指定URL。可以获取网页内容、截图、与页面交互。

使用场景：
- 需要JavaScript渲染的网页（普通fetch读不到内容）
- 需要登录后才能看到的内容
- 需要点击按钮、填写表单
- 需要截图或录制页面
- SPA单页应用内容提取
- 网页自动化测试

注意：首次使用会启动浏览器（约2-3秒），之后复用同一浏览器实例。`,
  parameters: z.object({
    url: z.string().describe('要打开的URL，如 https://example.com'),
    wait_for: z.string().optional().describe('等待条件：load(默认)/domcontentloaded/networkidle/selector:xxx'),
    take_screenshot: z.boolean().default(true).describe('是否截图'),
    session_id: z.string().default('default').describe('会话ID，同一ID复用同一页面'),
  }),
  execute: async ({ url, wait_for = 'load', take_screenshot = true, session_id = 'default' }: { url: string; wait_for?: string; take_screenshot?: boolean; session_id?: string }) => {
    try {
      const page = await getPage(session_id);
      
      await page.goto(url, { 
        waitUntil: wait_for as any || 'load',
        timeout: 30000,
      });
      
      let result = `✅ 页面已打开: ${url}\n标题: ${await page.title()}\nURL: ${page.url()}`;
      
      // 获取页面文本内容（简化版）
      const textContent = await page.evaluate(() => {
        const body = document.body;
        if (!body) return '';
        // 移除script和style
        const clone = body.cloneNode(true) as HTMLElement;
        clone.querySelectorAll('script, style, noscript').forEach(el => el.remove());
        return clone.innerText?.slice(0, 5000) || '';
      });
      
      if (textContent) {
        result += `\n\n页面内容摘要:\n${textContent.slice(0, 3000)}`;
      }
      
      // 截图
      if (take_screenshot) {
        const fs = await import('fs');
        fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
        const screenshotPath = `${SCREENSHOT_DIR}/${Date.now()}.png`;
        await page.screenshot({ path: screenshotPath, fullPage: false });
        result += `\n\n截图已保存: ${screenshotPath}`;
      }
      
      return result;
    } catch (error) {
      return `❌ 打开页面失败: ${error instanceof Error ? error.message : String(error)}`;
    }
  },
});

/**
 * browser_click - 点击元素
 */
export const browserClickTool = tool({
  description: `在浏览器页面中点击指定元素。先打开页面（browser_navigate），再点击。`,
  parameters: z.object({
    selector: z.string().describe('CSS选择器，如 #login-btn, a[href="/dashboard"], button:has-text("提交")'),
    session_id: z.string().default('default').describe('会话ID'),
    take_screenshot: z.boolean().default(true).describe('点击后是否截图'),
  }),
  execute: async ({ selector, session_id = 'default', take_screenshot = true }: { selector: string; session_id?: string; take_screenshot?: boolean }) => {
    try {
      const page = await getPage(session_id);
      
      await page.click(selector, { timeout: 10000 });
      
      // 等待页面响应
      await page.waitForTimeout(1000);
      
      let result = `✅ 已点击: ${selector}\n当前URL: ${page.url()}\n标题: ${await page.title()}`;
      
      if (take_screenshot) {
        const fs = await import('fs');
        fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
        const screenshotPath = `${SCREENSHOT_DIR}/${Date.now()}.png`;
        await page.screenshot({ path: screenshotPath });
        result += `\n截图: ${screenshotPath}`;
      }
      
      return result;
    } catch (error) {
      return `❌ 点击失败: ${error instanceof Error ? error.message : String(error)}\n提示：检查选择器是否正确，元素是否可见`;
    }
  },
});

/**
 * browser_fill - 填写表单
 */
export const browserFillTool = tool({
  description: `在浏览器页面中填写输入框或选择下拉菜单。用于登录、搜索、提交表单等。`,
  parameters: z.object({
    selector: z.string().describe('CSS选择器，如 #username, input[name="email"], textarea'),
    value: z.string().describe('要填入的值'),
    session_id: z.string().default('default').describe('会话ID'),
  }),
  execute: async ({ selector, value, session_id = 'default' }: { selector: string; value: string; session_id?: string }) => {
    try {
      const page = await getPage(session_id);
      
      await page.fill(selector, value, { timeout: 10000 });
      
      return `✅ 已填入: ${selector} = "${value.slice(0, 50)}${value.length > 50 ? '...' : ''}"`;
    } catch (error) {
      return `❌ 填写失败: ${error instanceof Error ? error.message : String(error)}`;
    }
  },
});

/**
 * browser_extract - 提取页面数据
 */
export const browserExtractTool = tool({
  description: `从当前浏览器页面提取数据。支持CSS选择器提取和JavaScript执行。`,
  parameters: z.object({
    selector: z.string().optional().describe('CSS选择器，提取匹配元素的文本。如 h1, .price, table tr'),
    extract_type: z.enum(['text', 'html', 'attribute', 'table', 'all_links', 'custom_js']).default('text').describe('提取类型：text=文本, html=HTML源码, attribute=属性值, table=表格数据, all_links=所有链接, custom_js=自定义JS'),
    attribute: z.string().optional().describe('当extract_type=attribute时，要提取的属性名，如href, src'),
    js_code: z.string().optional().describe('当extract_type=custom_js时，要执行的JavaScript代码（必须有return语句）'),
    session_id: z.string().default('default').describe('会话ID'),
  }),
  execute: async ({ selector, extract_type = 'text', attribute, js_code, session_id = 'default' }: { selector?: string; extract_type?: string; attribute?: string; js_code?: string; session_id?: string }) => {
    try {
      const page = await getPage(session_id);
      
      let result: any;
      
      switch (extract_type) {
        case 'text':
          if (!selector) return '❌ text模式需要提供selector';
          result = await page.$$eval(selector, (els) => els.map(el => el.textContent?.trim()).filter(Boolean));
          break;
          
        case 'html':
          if (!selector) return '❌ html模式需要提供selector';
          result = await page.$$eval(selector, (els) => els.map(el => el.innerHTML));
          break;
          
        case 'attribute':
          if (!selector || !attribute) return '❌ attribute模式需要selector和attribute';
          result = await page.$$eval(selector, (els, attr) => els.map(el => el.getAttribute(attr)), attribute);
          break;
          
        case 'table':
          result = await page.evaluate(() => {
            const tables = document.querySelectorAll('table');
            return Array.from(tables).map(table => {
              const headers = Array.from(table.querySelectorAll('th')).map(th => th.textContent?.trim());
              const rows = Array.from(table.querySelectorAll('tbody tr')).map(tr => 
                Array.from(tr.querySelectorAll('td')).map(td => td.textContent?.trim())
              );
              return { headers, rows };
            });
          });
          break;
          
        case 'all_links':
          result = await page.evaluate(() => {
            return Array.from(document.querySelectorAll('a[href]')).map(a => ({
              text: a.textContent?.trim(),
              href: a.getAttribute('href'),
            })).filter(l => l.href && !l.href.startsWith('javascript:'));
          });
          break;
          
        case 'custom_js':
          if (!js_code) return '❌ custom_js模式需要提供js_code';
          result = await page.evaluate(js_code);
          break;
      }
      
      const output = JSON.stringify(result, null, 2);
      if (output.length > 10000) {
        return `✅ 提取成功（结果已截断）:\n${output.slice(0, 10000)}\n... [共${output.length}字符]`;
      }
      
      return `✅ 提取成功:\n${output}`;
    } catch (error) {
      return `❌ 提取失败: ${error instanceof Error ? error.message : String(error)}`;
    }
  },
});

/**
 * browser_screenshot - 页面截图
 */
export const browserScreenshotTool = tool({
  description: `对当前浏览器页面截图。支持全页面和指定区域截图。`,
  parameters: z.object({
    full_page: z.boolean().default(false).describe('是否截取完整页面（包括滚动区域）'),
    selector: z.string().optional().describe('只截取指定元素区域'),
    session_id: z.string().default('default').describe('会话ID'),
  }),
  execute: async ({ full_page = false, selector, session_id = 'default' }: { full_page?: boolean; selector?: string; session_id?: string }) => {
    try {
      const page = await getPage(session_id);
      const fs = await import('fs');
      fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
      
      const screenshotPath = `${SCREENSHOT_DIR}/${Date.now()}.png`;
      
      if (selector) {
        const element = await page.$(selector);
        if (!element) return `❌ 未找到元素: ${selector}`;
        await element.screenshot({ path: screenshotPath });
      } else {
        await page.screenshot({ path: screenshotPath, fullPage: full_page });
      }
      
      return `✅ 截图已保存: ${screenshotPath}`;
    } catch (error) {
      return `❌ 截图失败: ${error instanceof Error ? error.message : String(error)}`;
    }
  },
});

/**
 * browser_execute_js - 执行JavaScript
 */
export const browserExecuteJsTool = tool({
  description: `在浏览器页面中执行自定义JavaScript代码。用于复杂交互或数据提取。`,
  parameters: z.object({
    js_code: z.string().describe('要执行的JavaScript代码。可以return返回结果。可用document对象。'),
    session_id: z.string().default('default').describe('会话ID'),
  }),
  execute: async ({ js_code, session_id = 'default' }: { js_code: string; session_id?: string }) => {
    try {
      const page = await getPage(session_id);
      const result = await page.evaluate(js_code);
      
      const output = typeof result === 'string' ? result : JSON.stringify(result, null, 2);
      return `✅ 执行成功:\n${output.slice(0, 5000)}`;
    } catch (error) {
      return `❌ 执行失败: ${error instanceof Error ? error.message : String(error)}`;
    }
  },
});

export const browserTools = {
  browser_navigate: browserNavigateTool,
  browser_click: browserClickTool,
  browser_fill: browserFillTool,
  browser_extract: browserExtractTool,
  browser_screenshot: browserScreenshotTool,
  browser_execute_js: browserExecuteJsTool,
};
