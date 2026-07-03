import assert from 'node:assert';
import { add } from '../src/lib/add';

let passed = 0;
let failed = 0;

function runTest(name: string, fn: () => void) {
  try {
    fn();
    console.log(`  ✅ ${name}`);
    passed++;
  } catch (err: any) {
    console.log(`  ❌ ${name} — ${err.message}`);
    failed++;
  }
}

console.log('\n📐 测试: add(a, b) 加法函数\n');

// ===== 正常用例 =====
runTest('正整数相加: add(1, 2) === 3', () => {
  assert.strictEqual(add(1, 2), 3);
});

runTest('零值相加: add(0, 5) === 5', () => {
  assert.strictEqual(add(0, 5), 5);
});

runTest('负整数相加: add(-1, -2) === -3', () => {
  assert.strictEqual(add(-1, -2), -3);
});

runTest('正负混合: add(-1, 1) === 0', () => {
  assert.strictEqual(add(-1, 1), 0);
});

runTest('浮点数相加: add(0.1, 0.2) === 0.30000000000000004', () => {
  assert.strictEqual(add(0.1, 0.2), 0.30000000000000004);
});

// ===== 边界用例 =====
runTest('大整数相加: add(999999999, 1) === 1000000000', () => {
  assert.strictEqual(add(999999999, 1), 1000000000);
});

runTest('NaN 输入: add(NaN, 1), 返回 NaN', () => {
  assert.ok(Number.isNaN(add(NaN, 1)));
});

// ===== 总结 =====
const total = passed + failed;
console.log(`\n📊 测试结果: ${passed}/${total} 通过` + (failed > 0 ? `, ${failed} 失败` : ''));
console.log('');
