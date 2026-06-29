/**
 * 排序算法集合 —— 含常见排序算法的 TypeScript 实现
 * 每种算法都包含：实现 + 时间复杂度/空间复杂度/稳定性说明
 */

// ======================== 工具函数 ========================

/** 交换数组中两个元素 */
function swap<T>(arr: T[], i: number, j: number): void {
  [arr[i], arr[j]] = [arr[j], arr[i]];
}

/** 生成随机整数数组 */
function randomArray(length: number, min = 0, max = 100): number[] {
  return Array.from({ length }, () => Math.floor(Math.random() * (max - min + 1)) + min);
}

/** 判断数组是否有序（升序） */
function isSorted(arr: number[]): boolean {
  for (let i = 1; i < arr.length; i++) {
    if (arr[i] < arr[i - 1]) return false;
  }
  return true;
}

// ======================== 1. 冒泡排序 O(n²) ========================

/**
 * 冒泡排序 — O(n²) / O(1) / 稳定
 * 思路：相邻元素两两比较，大的往后冒
 * 优化：一轮无交换则提前退出
 */
export function bubbleSort(arr: number[]): number[] {
  const a = [...arr];
  const n = a.length;
  let swapped: boolean;

  for (let i = 0; i < n - 1; i++) {
    swapped = false;
    for (let j = 0; j < n - 1 - i; j++) {
      if (a[j] > a[j + 1]) {
        swap(a, j, j + 1);
        swapped = true;
      }
    }
    if (!swapped) break; // 已有序，提前结束
  }
  return a;
}

// ======================== 2. 选择排序 O(n²) ========================

/**
 * 选择排序 — O(n²) / O(1) / 不稳定
 * 思路：每轮选最小放到前面
 */
export function selectionSort(arr: number[]): number[] {
  const a = [...arr];
  const n = a.length;

  for (let i = 0; i < n - 1; i++) {
    let minIdx = i;
    for (let j = i + 1; j < n; j++) {
      if (a[j] < a[minIdx]) minIdx = j;
    }
    if (minIdx !== i) swap(a, i, minIdx);
  }
  return a;
}

// ======================== 3. 插入排序 O(n²) ========================

/**
 * 插入排序 — O(n²) / O(1) / 稳定
 * 思路：将元素插入到已排序部分的正确位置
 * 特点：近乎有序的数组表现极佳 O(n)
 */
export function insertionSort(arr: number[]): number[] {
  const a = [...arr];
  const n = a.length;

  for (let i = 1; i < n; i++) {
    const key = a[i];
    let j = i - 1;
    while (j >= 0 && a[j] > key) {
      a[j + 1] = a[j];
      j--;
    }
    a[j + 1] = key;
  }
  return a;
}

// ======================== 4. 希尔排序 O(n log n)~O(n²) ========================

/**
 * 希尔排序 — O(n log n)~O(n²) / O(1) / 不稳定
 * 思路：插入排序的改进，先分组排序再逐步合并
 */
export function shellSort(arr: number[]): number[] {
  const a = [...arr];
  const n = a.length;

  // 使用 Knuth 增量序列: gap = gap * 3 + 1
  let gap = 1;
  while (gap < n / 3) gap = gap * 3 + 1;

  while (gap > 0) {
    for (let i = gap; i < n; i++) {
      const temp = a[i];
      let j = i;
      while (j >= gap && a[j - gap] > temp) {
        a[j] = a[j - gap];
        j -= gap;
      }
      a[j] = temp;
    }
    gap = Math.floor(gap / 3);
  }
  return a;
}

// ======================== 5. 归并排序 O(n log n) ========================

/**
 * 归并排序 — O(n log n) / O(n) / 稳定
 * 思路：分治法，先分后合
 */
export function mergeSort(arr: number[]): number[] {
  const a = [...arr];

  function merge(left: number[], right: number[]): number[] {
    const result: number[] = [];
    let i = 0, j = 0;

    while (i < left.length && j < right.length) {
      result.push(left[i] <= right[j] ? left[i++] : right[j++]);
    }
    return result.concat(left.slice(i)).concat(right.slice(j));
  }

  function sort(nums: number[]): number[] {
    if (nums.length <= 1) return nums;
    const mid = Math.floor(nums.length / 2);
    return merge(sort(nums.slice(0, mid)), sort(nums.slice(mid)));
  }

  return sort(a);
}

// ======================== 6. 快速排序 O(n log n) ========================

/**
 * 快速排序 — O(n log n) / O(log n) / 不稳定
 * 思路：选基准，分区，递归
 * 优化：三数取中法选基准，防止退化
 */
export function quickSort(arr: number[]): number[] {
  const a = [...arr];

  function sort(lo: number, hi: number): void {
    if (lo >= hi) return;

    // 三数取中：选 lo、mid、hi 的中位数作为 pivot
    const mid = lo + ((hi - lo) >> 1);
    if (a[lo] > a[mid]) swap(a, lo, mid);
    if (a[lo] > a[hi]) swap(a, lo, hi);
    if (a[mid] > a[hi]) swap(a, mid, hi);
    // 把 pivot 放到倒数第二个位置
    swap(a, mid, hi - 1);
    const pivot = a[hi - 1];

    let i = lo, j = hi - 1;
    while (i < j) {
      while (a[++i] < pivot) {}
      while (a[--j] > pivot) {}
      if (i < j) swap(a, i, j);
    }
    swap(a, i, hi - 1);

    sort(lo, i - 1);
    sort(i + 1, hi);
  }

  sort(0, a.length - 1);
  return a;
}

// ======================== 7. 堆排序 O(n log n) ========================

/**
 * 堆排序 — O(n log n) / O(1) / 不稳定
 * 思路：建最大堆，逐个弹出堆顶
 */
export function heapSort(arr: number[]): number[] {
  const a = [...arr];
  const n = a.length;

  function heapify(size: number, root: number): void {
    let largest = root;
    const left = 2 * root + 1;
    const right = 2 * root + 2;

    if (left < size && a[left] > a[largest]) largest = left;
    if (right < size && a[right] > a[largest]) largest = right;

    if (largest !== root) {
      swap(a, root, largest);
      heapify(size, largest);
    }
  }

  // 建堆
  for (let i = Math.floor(n / 2) - 1; i >= 0; i--) {
    heapify(n, i);
  }

  // 逐个弹出堆顶
  for (let i = n - 1; i > 0; i--) {
    swap(a, 0, i);
    heapify(i, 0);
  }
  return a;
}

// ======================== 8. 计数排序 O(n+k) ========================

/**
 * 计数排序 — O(n+k) / O(k) / 稳定
 * 思路：统计每个数出现次数，按序输出
 * 限制：仅适用于非负整数，且范围不大
 */
export function countingSort(arr: number[]): number[] {
  if (arr.length === 0) return [];
  const a = [...arr];
  const max = Math.max(...a);
  const min = Math.min(...a);
  const range = max - min + 1;
  const count = new Array(range).fill(0);

  for (const num of a) count[num - min]++;

  let idx = 0;
  for (let i = 0; i < range; i++) {
    while (count[i]-- > 0) a[idx++] = i + min;
  }
  return a;
}

// ======================== 9. 桶排序 O(n+k) ========================

/**
 * 桶排序 — 平均 O(n+k) / O(n) / 稳定
 * 思路：分桶 → 桶内排序 → 合并
 */
export function bucketSort(arr: number[], bucketSize = 5): number[] {
  if (arr.length <= 1) return [...arr];
  const a = [...arr];

  const min = Math.min(...a);
  const max = Math.max(...a);
  const bucketCount = Math.floor((max - min) / bucketSize) + 1;
  const buckets: number[][] = Array.from({ length: bucketCount }, () => []);

  for (const num of a) {
    buckets[Math.floor((num - min) / bucketSize)].push(num);
  }

  const result: number[] = [];
  for (const bucket of buckets) {
    if (bucket.length > 0) {
      result.push(...insertionSort(bucket)); // 桶内用插入排序
    }
  }
  return result;
}

// ======================== 10. 基数排序 O(nk) ========================

/**
 * 基数排序 — O(nk) / O(n+k) / 稳定
 * 思路：按位（个十百千）依次排序
 */
export function radixSort(arr: number[]): number[] {
  if (arr.length <= 1) return [...arr];
  const a = [...arr];

  const max = Math.max(...a);
  const maxDigits = String(max).length;

  for (let digit = 0; digit < maxDigits; digit++) {
    const buckets: number[][] = Array.from({ length: 10 }, () => []);
    const divisor = Math.pow(10, digit);

    for (const num of a) {
      const bucketIdx = Math.floor(num / divisor) % 10;
      buckets[bucketIdx].push(num);
    }

    let idx = 0;
    for (const bucket of buckets) {
      for (const num of bucket) a[idx++] = num;
    }
  }
  return a;
}

// ======================== 11. TimSort（混合排序） ========================

/**
 * TimSort — O(n log n) / O(n) / 稳定
 * 思路：归并+插入的混合，Python/Java 内置排序算法
 * 特点：充分利用现实数据中已有序的子序列(run)
 */
const MIN_MERGE = 32;

export function timSort(arr: number[]): number[] {
  const a = [...arr];
  const n = a.length;

  function insertionSortRange(lo: number, hi: number): void {
    for (let i = lo + 1; i <= hi; i++) {
      const key = a[i];
      let j = i - 1;
      while (j >= lo && a[j] > key) {
        a[j + 1] = a[j];
        j--;
      }
      a[j + 1] = key;
    }
  }

  function mergeRange(lo: number, mid: number, hi: number): void {
    const lenL = mid - lo + 1;
    const lenR = hi - mid;
    const left = a.slice(lo, mid + 1);
    const right = a.slice(mid + 1, hi + 1);
    let i = 0, j = 0, k = lo;

    while (i < lenL && j < lenR) {
      a[k++] = left[i] <= right[j] ? left[i++] : right[j++];
    }
    while (i < lenL) a[k++] = left[i++];
    while (j < lenR) a[k++] = right[j++];
  }

  // 小数组直接插入排序
  if (n < MIN_MERGE) {
    insertionSortRange(0, n - 1);
    return a;
  }

  // 切分 runs
  for (let i = 0; i < n; i += MIN_MERGE) {
    insertionSortRange(i, Math.min(i + MIN_MERGE - 1, n - 1));
  }

  // 合并 runs
  for (let size = MIN_MERGE; size < n; size *= 2) {
    for (let left = 0; left < n; left += 2 * size) {
      const mid = left + size - 1;
      const right = Math.min(left + 2 * size - 1, n - 1);
      if (mid < right) mergeRange(left, mid, right);
    }
  }
  return a;
}

// ======================== 性能测试 ========================

interface SortResult {
  name: string;
  time: number;
  correct: boolean;
}

export function benchmark(size = 10_000, runs = 3): SortResult[] {
  const algorithms: [string, (arr: number[]) => number[]][] = [
    ['冒泡排序', bubbleSort],
    ['选择排序', selectionSort],
    ['插入排序', insertionSort],
    ['希尔排序', shellSort],
    ['归并排序', mergeSort],
    ['快速排序', quickSort],
    ['堆排序',   heapSort],
    ['计数排序', countingSort],
    ['桶排序',   bucketSort],
    ['基数排序', radixSort],
    ['TimSort',  timSort],
  ];

  const results: SortResult[] = [];

  for (const [name, sortFn] of algorithms) {
    const arr = randomArray(size, 0, size * 10);
    let totalTime = 0;
    let sorted: number[] = [];

    for (let r = 0; r < runs; r++) {
      const testArr = r === 0 ? arr : randomArray(size, 0, size * 10);
      const start = performance.now();
      sorted = sortFn(testArr);
      totalTime += performance.now() - start;
    }

    const avgTime = totalTime / runs;
    results.push({
      name,
      time: Math.round(avgTime * 100) / 100,
      correct: isSorted(sorted),
    });
  }

  return results;
}

// ======================== 主函数 ========================

if (require.main === module) {
  const testData = randomArray(10, 0, 50);
  console.log('原始数据:', testData);
  console.log();

  const algorithms: [string, (arr: number[]) => number[]][] = [
    ['冒泡排序', bubbleSort],
    ['选择排序', selectionSort],
    ['插入排序', insertionSort],
    ['希尔排序', shellSort],
    ['归并排序', mergeSort],
    ['快速排序', quickSort],
    ['堆排序',   heapSort],
    ['计数排序', countingSort],
    ['桶排序',   bucketSort],
    ['基数排序', radixSort],
    ['TimSort',  timSort],
  ];

  for (const [name, sortFn] of algorithms) {
    const result = sortFn(testData);
    const ok = isSorted(result);
    console.log(`${ok ? '✅' : '❌'} ${name.padEnd(8)} → ${result.join(', ')}`);
  }

  console.log('\n========== 性能对比（n=5,000）==========');
  const results = benchmark(5_000, 2);
  results.sort((a, b) => a.time - b.time);

  console.log('排名 | 算法        | 耗时(ms) | 正确性');
  console.log('-----|-------------|----------|--------');
  results.forEach((r, i) => {
    console.log(`  ${i + 1}  | ${r.name.padEnd(10)} | ${String(r.time).padStart(8)} | ${r.correct ? '✅' : '❌'}`);
  });

  console.log('\n📊 时间复杂度汇总：');
  console.log('  O(n²)     → 冒泡、选择、插入');
  console.log('  O(n log n) → 归并、快速、堆、TimSort');
  console.log('  O(n+k)    → 计数、桶');
  console.log('  O(nk)     → 基数');
}
