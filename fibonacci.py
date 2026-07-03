"""
斐波那契数列计算模块

提供迭代和递归两种实现方式，包含完整的类型注解、文档字符串和输入验证。
"""

from typing import Union
import sys
import math


def calculate_fibonacci(n: int, method: str = "iterative") -> int:
    """计算第 n 个斐波那契数。

    斐波那契数列定义：
        F(0) = 0, F(1) = 1
        F(n) = F(n-1) + F(n-2)  (n >= 2)

    Args:
        n: 非负整数，表示要计算的斐波那契数列索引（从 0 开始）。
        method: 计算方法，可选 "iterative"（迭代，默认）或 "recursive"（递归）。

    Returns:
        第 n 个斐波那契数。

    Raises:
        ValueError: 当 n 不是非负整数时抛出。
        RecursionError: 递归方法在 n 过大时可能超过最大递归深度。

    Examples:
        >>> calculate_fibonacci(0)
        0
        >>> calculate_fibonacci(1)
        1
        >>> calculate_fibonacci(10)
        55
        >>> calculate_fibonacci(10, method="recursive")
        55
        >>> calculate_fibonacci(50, method="iterative")
        12586269025
    """
    # ── 输入验证 ──────────────────────────────────────────────
    if not isinstance(n, int):
        raise ValueError(f"n 必须是整数，但收到了 {type(n).__name__}: {n!r}")
    if n < 0:
        raise ValueError(f"n 必须是非负整数，但收到了 {n}")

    if method == "iterative":
        return _fibonacci_iterative(n)
    elif method == "recursive":
        if n > 35:
            import warnings
            warnings.warn(
                f"递归方法在 n={n} 时性能较差，建议使用迭代方法。",
                UserWarning,
                stacklevel=2,
            )
        return _fibonacci_recursive(n)
    else:
        raise ValueError(
            f"method 必须是 'iterative' 或 'recursive'，但收到了 {method!r}"
        )


def _fibonacci_iterative(n: int) -> int:
    """迭代实现：时间复杂度 O(n)，空间复杂度 O(1)。"""
    if n == 0:
        return 0
    a, b = 0, 1
    for _ in range(2, n + 1):
        a, b = b, a + b
    return b


def _fibonacci_recursive(n: int) -> int:
    """递归实现（带记忆化）：时间复杂度 O(n)，空间复杂度 O(n)。"""
    _memo: dict[int, int] = {}

    def fib(k: int) -> int:
        if k in _memo:
            return _memo[k]
        if k == 0:
            result = 0
        elif k == 1:
            result = 1
        else:
            result = fib(k - 1) + fib(k - 2)
        _memo[k] = result
        return result

    return fib(n)


# ── Binet 公式（附加：常数时间近似） ──────────────────────────────
def fibonacci_binet(n: int) -> int:
    """使用 Binet 公式 O(1) 计算精确整数结果。

    仅适用于 n <= 70（受浮点精度限制）。
    """
    if not isinstance(n, int) or n < 0:
        raise ValueError("n 必须是非负整数")
    if n > 70:
        raise ValueError("Binet 公式仅在 n <= 70 时保证精确")
    sqrt5 = math.sqrt(5)
    phi = (1 + sqrt5) / 2
    return round(phi ** n / sqrt5)


# ── 测试用例 ────────────────────────────────────────────────────
def run_tests() -> None:
    """运行所有测试用例。"""
    test_cases: list[tuple[int, int]] = [
        (0, 0),
        (1, 1),
        (2, 1),
        (3, 2),
        (4, 3),
        (5, 5),
        (6, 8),
        (7, 13),
        (10, 55),
        (20, 6765),
        (30, 832040),
        (50, 12586269025),
    ]

    print("=" * 60)
    print("斐波那契数列测试")
    print("=" * 60)

    # ── 迭代方法测试 ──
    print("\n📌 迭代方法：")
    all_pass = True
    for n, expected in test_cases:
        result = calculate_fibonacci(n, method="iterative")
        status = "✅" if result == expected else "❌"
        if result != expected:
            all_pass = False
        print(f"  F({n:>2}) = {result:>15}  {status}  (预期 {expected})")

    # ── 递归方法测试（仅前几个，避免过慢） ──
    print("\n📌 递归方法（记忆化）：")
    for n, expected in test_cases[:8]:  # 只测较小的 n
        result = calculate_fibonacci(n, method="recursive")
        status = "✅" if result == expected else "❌"
        if result != expected:
            all_pass = False
        print(f"  F({n:>2}) = {result:>5}  {status}  (预期 {expected})")

    # ── Binet 公式测试 ──
    print("\n📌 Binet 公式：")
    for n, expected in test_cases[:5]:
        result = fibonacci_binet(n)
        status = "✅" if result == expected else "❌"
        if result != expected:
            all_pass = False
        print(f"  F({n:>2}) = {result:>5}  {status}  (预期 {expected})")

    # ── 输入验证测试 ──
    print("\n📌 输入验证：")
    error_tests = [
        ("负数", -1, ValueError),
        ("浮点数", 3.14, ValueError),
        ("字符串", "hello", ValueError),
        ("无效方法", (5, "fast"), ValueError),
    ]
    for desc, *args in error_tests:
        try:
            if isinstance(args[0], tuple):
                calculate_fibonacci(*args[0])
            else:
                calculate_fibonacci(args[0])
            print(f"  ❌ {desc}: 应该抛出异常但未抛出")
            all_pass = False
        except ValueError:
            print(f"  ✅ {desc}: 正确抛出 ValueError")
        except Exception as e:
            print(f"  ⚠️  {desc}: 抛出了 {type(e).__name__}: {e}")

    # ── 总结 ──
    print("\n" + "=" * 60)
    if all_pass:
        print("🎉 所有测试通过！")
    else:
        print("⚠️  部分测试失败，请检查上方输出。")
    print("=" * 60)


if __name__ == "__main__":
    run_tests()
