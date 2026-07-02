<?php
/**
 * AI Agent Platform - PHP Entry
 * 用于辅助反向代理或兼容检测
 */

// 如果是 phpinfo 检测请求，返回基本信息
if (isset($_GET['info'])) {
    phpinfo();
    exit;
}

// 健康检查端点
if (isset($_GET['health'])) {
    header('Content-Type: application/json');
    echo json_encode([
        'status' => 'ok',
        'time'   => date('Y-m-d H:i:s'),
        'php'    => PHP_VERSION,
    ]);
    exit;
}

// 默认输出
header('Content-Type: text/html; charset=utf-8');
?>
<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>AI Agent Platform</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; display: flex; justify-content: center; align-items: center; min-height: 100vh; margin: 0; background: #0f0f14; color: #e0e0e0; }
        .card { text-align: center; padding: 40px; border-radius: 12px; background: #1a1a24; border: 1px solid #2a2a3a; }
        h1 { color: #7c3aed; margin-bottom: 8px; }
        p { color: #888; }
        .badge { display: inline-block; padding: 4px 12px; border-radius: 20px; background: #7c3aed22; color: #7c3aed; font-size: 13px; margin-top: 16px; }
    </style>
</head>
<body>
    <div class="card">
        <h1>AI Agent Platform</h1>
        <p>Next.js 应用运行中 · PHP <?= PHP_VERSION ?></p>
        <div class="badge">健康状态 ✓</div>
    </div>
</body>
</html>
