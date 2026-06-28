// @ts-nocheck
// AI SDK v7 tool() type inference issue
import { tool } from 'ai';
import { z } from 'zod';

// Preview HTML content - returns a special marker that the frontend renders as an iframe
export const preview_html = tool({
  description: `Preview HTML content in a sandboxed iframe. Use this when you generate HTML/CSS/JS code and want the user to see the live rendered result.
The content will be rendered in a secure sandboxed iframe with device viewport options (desktop/tablet/mobile).
Always call this after generating complete HTML code so the user can see the result immediately.
Do NOT use this for markdown or plain text - only for actual HTML that should be rendered as a web page.`,
  parameters: z.object({
    html: z.string().describe('The complete HTML content to preview (must include <!DOCTYPE html> or <html> tag)'),
    title: z.string().optional().describe('Title for the preview (e.g. "Login Page", "Dashboard Layout")'),
    viewport: z.enum(['desktop', 'tablet', 'mobile']).default('desktop').describe('Viewport size: desktop(100%), tablet(768px), mobile(375px)'),
  }),
  execute: async ({ html, title, viewport = 'desktop' }) => {
    // Return a special marker that parseContent in MessageBubble can detect
    const encodedHtml = Buffer.from(html).toString('base64');
    return `<!--HTML_PREVIEW\ntitle:${title || 'Preview'}\nviewport:${viewport}\nhtml:${encodedHtml}\n-->`;
  },
});

export const previewTools = {
  preview_html,
};
