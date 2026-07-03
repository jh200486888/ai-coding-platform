// @ts-nocheck
/**
 * 多模态输出工具 - 图表/PPT/文档生成
 * 让AI能在对话中主动生成图表、PPT和文档
 */
import { tool } from 'ai';
import { z } from 'zod';
import { query, run, getSetting } from '@/lib/db';
import { logger } from './logger';

// ============ generate_chart - 图表生成 ============
export function createGenerateChartTool() {
  return tool({
    description: '生成数据可视化图表（折线图/柱状图/饼图/散点图/雷达图等）。返回SVG图片URL，可直接在对话中展示。',
    inputSchema: z.object({
      chart_type: z.enum(['line', 'bar', 'pie', 'scatter', 'radar', 'area', 'funnel', 'heatmap']).describe('图表类型'),
      title: z.string().describe('图表标题'),
      data: z.object({
        labels: z.array(z.string()).describe('数据标签（X轴或分类名称）'),
        series: z.array(z.object({
          name: z.string().describe('系列名称'),
          values: z.array(z.number()).describe('数据值'),
        })).describe('数据系列'),
      }).describe('图表数据'),
      options: z.object({
        width: z.number().optional().describe('宽度px，默认800'),
        height: z.number().optional().describe('高度px，默认500'),
        show_legend: z.boolean().optional().describe('是否显示图例，默认true'),
        show_values: z.boolean().optional().describe('是否显示数值标签，默认false'),
      }).optional().describe('图表选项'),
    }),
    execute: async function ({ chart_type, title, data, options: opts = {} }) {
      try {
        const width = opts.width || 800;
        const height = opts.height || 500;

        // Generate chart using ECharts in a headless way
        // We'll create an HTML file that renders the chart and return the config
        const chartConfig = {
          title: { text: title, left: 'center', textStyle: { fontSize: 18 } },
          tooltip: { trigger: chart_type === 'pie' ? 'item' : 'axis' },
          legend: { show: opts.show_legend !== false, bottom: 10 },
          ...(chart_type === 'pie' ? {
            series: [{
              type: 'pie',
              radius: '60%',
              data: data.labels.map((label, i) => ({
                name: label,
                value: data.series[0]?.values[i] || 0,
              })),
              label: { show: opts.show_values !== false, formatter: '{b}: {c} ({d}%)' },
            }],
          } : chart_type === 'radar' ? {
            radar: { indicator: data.labels.map(l => ({ name: l, max: Math.max(...data.series.flatMap(s => s.values)) * 1.2 })) },
            series: data.series.map(s => ({ type: 'radar', name: s.name, data: [{ value: s.values, name: s.name }] })),
          } : {
            xAxis: { type: 'category', data: data.labels },
            yAxis: { type: 'value' },
            series: data.series.map(s => ({
              type: chart_type === 'area' ? 'line' : chart_type,
              name: s.name,
              data: s.values,
              areaStyle: chart_type === 'area' ? {} : undefined,
              smooth: chart_type === 'line' || chart_type === 'area',
              label: { show: opts.show_values || false, position: 'top' },
            })),
          }),
        };

        // Save chart config to DB for frontend rendering
        const chartId = `chart_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
        await run(
          `INSERT INTO generated_artifacts (id, type, title, content, created_at) VALUES ($1, $2, $3, $4, NOW())`,
          [chartId, 'chart', title, JSON.stringify(chartConfig)]
        );

        return `图表已生成！\n\n标题：${title}\n类型：${chart_type}\n数据系列：${data.series.length}个\n标签数：${data.labels.length}个\n\n图表ID：${chartId}\n\n用户可在前端查看交互式图表。你也可以继续调整图表参数。`;
      } catch (e) {
        return `图表生成失败: ${e.message}。请检查数据格式是否正确。`;
      }
    },
  });
}

// ============ generate_ppt - PPT生成 ============
export function createGeneratePptTool() {
  return tool({
    description: '生成PPT演示文稿。支持多页、标题+内容格式。返回下载链接。',
    inputSchema: z.object({
      title: z.string().describe('PPT主标题'),
      slides: z.array(z.object({
        title: z.string().describe('幻灯片标题'),
        content: z.array(z.string()).describe('内容要点列表'),
        notes: z.string().optional().describe('演讲者备注'),
      })).describe('幻灯片列表'),
      theme: z.enum(['professional', 'creative', 'minimal', 'dark']).optional().describe('主题风格，默认professional'),
    }),
    execute: async function ({ title, slides, theme = 'professional' }) {
      try {
        const pptx = require('pptxgenjs');
        const pres = new pptx();
        pres.layout = 'LAYOUT_16x9';

        // Theme colors
        const themes = {
          professional: { bg: 'FFFFFF', titleColor: '1B2A4A', textColor: '333333', accent: '2E5AAC' },
          creative: { bg: 'FFFFFF', titleColor: 'E8553D', textColor: '444444', accent: 'F5A623' },
          minimal: { bg: 'FFFFFF', titleColor: '000000', textColor: '666666', accent: '999999' },
          dark: { bg: '1A1A2E', titleColor: 'E94560', textColor: 'CCCCCC', accent: '0F3460' },
        };
        const t = themes[theme] || themes.professional;

        // Title slide
        const titleSlide = pres.addSlide();
        titleSlide.background = { color: t.accent };
        titleSlide.addText(title, { x: 1, y: 2, w: 8, h: 1.5, fontSize: 36, color: 'FFFFFF', bold: true, align: 'center' });
        titleSlide.addText(new Date().toLocaleDateString('zh-CN'), { x: 1, y: 3.8, w: 8, h: 0.5, fontSize: 14, color: 'FFFFFF', align: 'center' });

        // Content slides
        for (const slide of slides) {
          const s = pres.addSlide();
          s.background = { color: t.bg };
          // Title
          s.addText(slide.title, { x: 0.8, y: 0.4, w: 8.4, h: 0.8, fontSize: 24, color: t.titleColor, bold: true });
          // Divider line
          s.addShape(pres.ShapeType.line, { x: 0.8, y: 1.2, w: 8.4, h: 0, line: { color: t.accent, width: 2 } });
          // Content bullets
          const bulletItems = slide.content.map(text => ({
            text,
            options: { bullet: { type: 'bullet', color: t.accent }, fontSize: 16, color: t.textColor, paraSpaceAfter: 8 },
          }));
          s.addText(bulletItems, { x: 1, y: 1.5, w: 8, h: 4.5, valign: 'top' });
          // Notes
          if (slide.notes) {
            s.addNotes(slide.notes);
          }
        }

        // Save to generated_artifacts
        const pptBuffer = await pres.write({ outputType: 'nodebuffer' });
        const pptId = `ppt_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
        
        // Store as base64 in DB
        const b64 = pptBuffer.toString('base64');
        await run(
          `INSERT INTO generated_artifacts (id, type, title, content, created_at) VALUES ($1, $2, $3, $4, NOW())`,
          [pptId, 'pptx', title, b64]
        );

        return `PPT已生成！\n\n标题：${title}\n幻灯片数：${slides.length + 1}页（含封面）\n主题：${theme}\n\nPPT ID：${pptId}\n用户可通过 /api/artifacts/${pptId}/download 下载。`;
      } catch (e) {
        return `PPT生成失败: ${e.message}`;
      }
    },
  });
}

// ============ generate_document - 文档生成 ============
export function createGenerateDocumentTool() {
  return tool({
    description: '生成专业文档（Word/Markdown/HTML）。适合需要正式交付的文档场景。',
    inputSchema: z.object({
      title: z.string().describe('文档标题'),
      sections: z.array(z.object({
        heading: z.string().describe('章节标题'),
        content: z.string().describe('章节内容（支持Markdown格式）'),
        level: z.number().optional().describe('标题级别1-6，默认2'),
      })).describe('文档章节列表'),
      format: z.enum(['docx', 'markdown', 'html']).optional().describe('输出格式，默认docx'),
    }),
    execute: async function ({ title, sections, format: fmt = 'docx' }) {
      try {
        // Build markdown content first
        let md = `# ${title}\n\n`;
        for (const section of sections) {
          const level = section.level || 2;
          const prefix = '#'.repeat(level);
          md += `${prefix} ${section.heading}\n\n${section.content}\n\n`;
        }

        if (fmt === 'markdown') {
          const docId = `doc_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
          await run(
            `INSERT INTO generated_artifacts (id, type, title, content, created_at) VALUES ($1, $2, $3, $4, NOW())`,
            [docId, 'markdown', title, md]
          );
          return `Markdown文档已生成！\n\n标题：${title}\n章节数：${sections.length}\n文档ID：${docId}`;
        }

        // For docx - use existing export API logic
        const docId = `doc_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
        await run(
          `INSERT INTO generated_artifacts (id, type, title, content, created_at) VALUES ($1, $2, $3, $4, NOW())`,
          [docId, fmt, title, md]
        );

        return `文档已生成！\n\n标题：${title}\n格式：${fmt}\n章节数：${sections.length}\n\n文档ID：${docId}\n用户可通过 /api/artifacts/${docId}/download 下载。`;
      } catch (e) {
        return `文档生成失败: ${e.message}`;
      }
    },
  });
}

// ============ generate_excel - Excel生成 ============
export function createGenerateExcelTool() {
  return tool({
    description: '⚡ 生成Excel电子表格(.xlsx)。支持多工作表、表头格式化、自动列宽、冻结首行、自动筛选。当用户需要生成表格、数据报告、统计表、清单时，直接使用此工具，不要写代码生成Excel。',
    inputSchema: z.object({
      title: z.string().describe('工作簿标题'),
      sheets: z.array(z.object({
        name: z.string().describe('工作表名称'),
        headers: z.array(z.string()).describe('表头列名'),
        rows: z.array(z.array(z.any())).describe('数据行（每行是值的数组）'),
        column_widths: z.array(z.number()).optional().describe('列宽数组（可选）'),
        freeze_header: z.boolean().optional().describe('是否冻结首行，默认true'),
      })).describe('工作表列表'),
      auto_filter: z.boolean().optional().describe('是否自动筛选，默认true'),
    }),
    execute: async function ({ title, sheets, auto_filter = true }) {
      try {
        const ExcelJS = require('exceljs');
        const wb = new ExcelJS.Workbook();
        wb.creator = 'AI Coding Platform';
        wb.created = new Date();

        for (const sheet of sheets) {
          const ws = wb.addWorksheet(sheet.name);

          // Headers with formatting
          const headerRow = ws.addRow(sheet.headers);
          headerRow.eachCell((cell: any) => {
            cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2E5AAC' } };
            cell.alignment = { horizontal: 'center', vertical: 'middle' };
            cell.border = { bottom: { style: 'thin', color: { argb: 'FF999999' } } };
          });
          headerRow.height = 24;

          // Data rows
          for (const row of sheet.rows) {
            const dataRow = ws.addRow(row);
            dataRow.eachCell((cell: any) => {
              cell.border = { bottom: { style: 'hair', color: { argb: 'FFDDDDDD' } } };
            });
          }

          // Column widths
          if (sheet.column_widths && sheet.column_widths.length > 0) {
            sheet.column_widths.forEach((w: number, i: number) => {
              if (ws.getColumn(i + 1)) ws.getColumn(i + 1).width = w;
            });
          } else {
            // Auto-width based on content
            ws.columns.forEach((col: any) => {
              let maxLen = 10;
              col.eachCell({ includeEmpty: false }, (cell: any) => {
                const len = cell.value ? String(cell.value).length : 0;
                if (len > maxLen) maxLen = len;
              });
              col.width = Math.min(maxLen + 2, 50);
            });
          }

          // Freeze header row
          if (sheet.freeze_header !== false) {
            ws.views = [{ state: 'frozen', ySplit: 1 }];
          }

          // Auto filter
          if (auto_filter && sheet.headers.length > 0) {
            ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: sheet.rows.length + 1, column: sheet.headers.length } };
          }
        }

        const buffer = await wb.xlsx.writeBuffer();
        const b64 = Buffer.from(buffer).toString('base64');
        const excelId = `excel_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

        await run(
          `INSERT INTO generated_artifacts (id, type, title, content, created_at) VALUES ($1, $2, $3, $4, NOW())`,
          [excelId, 'xlsx', title, b64]
        );

        return `Excel已生成！\n\n标题：${title}\n工作表数：${sheets.length}\n总数据行：${sheets.reduce((sum, s) => sum + s.rows.length, 0)}行\n\nExcel ID：${excelId}\n用户可通过 /api/artifacts/${excelId}/download 下载。`;
      } catch (e) {
        return `Excel生成失败: ${e.message}`;
      }
    },
  });
}

