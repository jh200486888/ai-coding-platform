"""
简易 Python 计算器
支持：加减乘除、取余、幂运算、开平方、三角函数、对数
"""

import math

def show_menu():
    print("\n" + "=" * 40)
    print("           🧮 Python 计算器")
    print("=" * 40)
    print(" 1. 加法 (+)        2. 减法 (-)")
    print(" 3. 乘法 (×)        4. 除法 (÷)")
    print(" 5. 取余 (%)        6. 幂运算 (^)")
    print(" 7. 开平方 (√)      8. 三角函数")
    print(" 9. 对数运算        0. 退出")
    print("=" * 40)


def get_number(prompt="请输入数字: "):
    while True:
        try:
            return float(input(prompt))
        except ValueError:
            print("❌ 输入无效，请输入数字。")


def add():
    a = get_number("第一个数: ")
    b = get_number("第二个数: ")
    print(f"\n✅ {a} + {b} = {a + b}")


def subtract():
    a = get_number("第一个数: ")
    b = get_number("第二个数: ")
    print(f"\n✅ {a} - {b} = {a - b}")


def multiply():
    a = get_number("第一个数: ")
    b = get_number("第二个数: ")
    print(f"\n✅ {a} × {b} = {a * b}")


def divide():
    a = get_number("被除数: ")
    b = get_number("除数: ")
    if b == 0:
        print("\n❌ 错误：除数不能为零！")
        return
    print(f"\n✅ {a} ÷ {b} = {a / b}")
    print(f"   整除: {a // b}")
    print(f"   余数: {a % b}")


def modulo():
    a = get_number("被除数: ")
    b = get_number("除数: ")
    if b == 0:
        print("\n❌ 错误：除数不能为零！")
        return
    print(f"\n✅ {a} % {b} = {a % b}")


def power():
    a = get_number("底数: ")
    b = get_number("指数: ")
    print(f"\n✅ {a} ^ {b} = {a ** b}")


def square_root():
    a = get_number("请输入数字: ")
    if a < 0:
        print("\n❌ 错误：不能对负数开平方！")
        return
    sqrt_val = math.sqrt(a)
    print(f"\n✅ √{a} = {sqrt_val}")
    if a == int(a):
        a_int = int(a)
        sqrt_int = int(sqrt_val)
        if sqrt_int * sqrt_int == a_int:
            print(f"   ✓ {a_int} 是完全平方数 ({sqrt_int} × {sqrt_int})")


def trig():
    print("\n三角函数（角度制）:")
    print("  s - sin")
    print("  c - cos")
    print("  t - tan")
    choice = input("选择函数 (s/c/t): ").strip().lower()
    if choice not in ("s", "c", "t"):
        print("❌ 无效选择")
        return
    deg = get_number("角度: ")
    rad = math.radians(deg)
    names = {"s": "sin", "c": "cos", "t": "tan"}
    funcs = {"s": math.sin, "c": math.cos, "t": math.tan}
    if choice == "t" and deg % 180 == 90:
        print(f"\n❌ tan({deg}°) 无定义")
        return
    result = funcs[choice](rad)
    print(f"\n✅ {names[choice]}({deg}°) = {result:.6f}")


def logarithm():
    print("\n选择底数:")
    print("  1 - 自然对数 (ln)")
    print("  2 - 常用对数 (lg, 底数10)")
    print("  3 - 自定义底数")
    choice = input("选择 (1/2/3): ").strip()
    x = get_number("请输入真数: ")
    if x <= 0:
        print("\n❌ 错误：真数必须大于 0！")
        return
    if choice == "1":
        print(f"\n✅ ln({x}) = {math.log(x):.6f}")
    elif choice == "2":
        print(f"\n✅ lg({x}) = {math.log10(x):.6f}")
    elif choice == "3":
        base = get_number("底数: ")
        if base <= 0 or base == 1:
            print("\n❌ 错误：底数必须大于 0 且不等于 1！")
            return
        print(f"\n✅ log_{base}({x}) = {math.log(x, base):.6f}")
    else:
        print("❌ 无效选择")


def main():
    actions = {
        1: add,
        2: subtract,
        3: multiply,
        4: divide,
        5: modulo,
        6: power,
        7: square_root,
        8: trig,
        9: logarithm,
    }
    while True:
        show_menu()
        try:
            choice = int(input("请选择功能 (0-9): "))
        except ValueError:
            print("❌ 请输入数字 0-9")
            continue
        if choice == 0:
            print("\n👋 感谢使用，再见！")
            break
        if choice in actions:
            actions[choice]()
        else:
            print("❌ 无效选项，请输入 0-9")


if __name__ == "__main__":
    main()
