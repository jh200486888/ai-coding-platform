def quicksort(arr):
    """
    快速排序算法（Quick Sort）
    
    时间复杂度：平均 O(n log n)，最坏 O(n²)
    空间复杂度：O(log n)（递归栈）
    稳定性：不稳定
    """
    # 基础条件：数组为空或只有一个元素时直接返回
    if len(arr) <= 1:
        return arr

    # 选择基准值（pivot），这里取中间元素
    pivot = arr[len(arr) // 2]

    # 分区（Partition）：
    # 小于基准的放左边，等于的放中间，大于的放右边
    left = [x for x in arr if x < pivot]
    middle = [x for x in arr if x == pivot]
    right = [x for x in arr if x > pivot]

    # 递归排序左右分区，然后合并
    return quicksort(left) + middle + quicksort(right)


def quicksort_inplace(arr, low=0, high=None):
    """
    原地快速排序（省内存版）
    
    直接在原数组上交换元素，不创建新列表。
    """
    if high is None:
        high = len(arr) - 1

    if low < high:
        # 分区，返回基准的最终位置
        pi = partition(arr, low, high)
        # 递归排序左右两部分
        quicksort_inplace(arr, low, pi - 1)
        quicksort_inplace(arr, pi + 1, high)


def partition(arr, low, high):
    """
    分区函数：选最后一个元素为基准，
    把小于基准的放左边，大于的放右边。
    """
    pivot = arr[high]  # 选最后一个元素做基准
    i = low - 1        # i 指向小于基准的最后一个元素

    for j in range(low, high):
        # 当前元素 <= 基准，交换到左边
        if arr[j] <= pivot:
            i += 1
            arr[i], arr[j] = arr[j], arr[i]

    # 把基准放到正确位置
    arr[i + 1], arr[high] = arr[high], arr[i + 1]
    return i + 1


# ===== 使用示例 =====
if __name__ == "__main__":
    # 简单版（返回新数组）
    data = [3, 6, 8, 10, 1, 2, 1]
    print("原始:", data)
    print("排序后(新数组):", quicksort(data))

    # 原地版（直接修改原数组）
    data2 = [9, -3, 5, 2, 6, 8, -6, 1, 3]
    print("\n原始:", data2)
    quicksort_inplace(data2)
    print("排序后(原地):", data2)
