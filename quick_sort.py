def quick_sort(arr):
    """快速排序 - 经典实现"""
    if len(arr) <= 1:
        return arr
    pivot = arr[len(arr) // 2]
    left = [x for x in arr if x < pivot]
    middle = [x for x in arr if x == pivot]
    right = [x for x in arr if x > pivot]
    return quick_sort(left) + middle + quick_sort(right)


def quick_sort_inplace(arr, low=0, high=None):
    """快速排序 - 原地排序（省内存）"""
    if high is None:
        high = len(arr) - 1

    if low < high:
        pi = partition(arr, low, high)
        quick_sort_inplace(arr, low, pi - 1)
        quick_sort_inplace(arr, pi + 1, high)
    return arr


def partition(arr, low, high):
    """分区函数"""
    pivot = arr[high]
    i = low - 1
    for j in range(low, high):
        if arr[j] <= pivot:
            i += 1
            arr[i], arr[j] = arr[j], arr[i]
    arr[i + 1], arr[high] = arr[high], arr[i + 1]
    return i + 1


if __name__ == "__main__":
    # 测试
    test = [3, 6, 8, 10, 1, 2, 1]
    print(f"原始: {test}")
    print(f"经典: {quick_sort(test.copy())}")
    print(f"原地: {quick_sort_inplace(test.copy())}")

    # 边界
    print(f"空列表: {quick_sort([])}")
    print(f"单元素: {quick_sort([42])}")
    print(f"已排序: {quick_sort([1, 2, 3, 4, 5])}")
    print(f"逆序:   {quick_sort([5, 4, 3, 2, 1])}")
