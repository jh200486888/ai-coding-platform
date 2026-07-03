// ============================================
// 🚀 统计卡片组件 - 服务端渲染
// ============================================

interface StatsProps {
  stats: {
    total: number;
    todo: number;
    inProgress: number;
    done: number;
  };
}

export function DemoStats({ stats }: StatsProps) {
  const cards = [
    {
      label: '全部任务',
      value: stats.total,
      icon: '📊',
      color: 'from-blue-500/10 to-blue-500/5 border-blue-500/20',
      textColor: 'text-blue-500',
    },
    {
      label: '待处理',
      value: stats.todo,
      icon: '📝',
      color: 'from-yellow-500/10 to-yellow-500/5 border-yellow-500/20',
      textColor: 'text-yellow-500',
    },
    {
      label: '进行中',
      value: stats.inProgress,
      icon: '🔄',
      color: 'from-purple-500/10 to-purple-500/5 border-purple-500/20',
      textColor: 'text-purple-500',
    },
    {
      label: '已完成',
      value: stats.done,
      icon: '✅',
      color: 'from-green-500/10 to-green-500/5 border-green-500/20',
      textColor: 'text-green-500',
    },
  ];

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {cards.map((card) => (
        <div
          key={card.label}
          className={`rounded-xl border bg-gradient-to-br ${card.color} p-5 transition-all hover:shadow-md hover:scale-[1.02]`}
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-2xl">{card.icon}</span>
            <span className={`text-3xl font-bold ${card.textColor}`}>
              {card.value}
            </span>
          </div>
          <p className="text-sm text-muted-foreground">{card.label}</p>
          <div className="mt-3 h-1.5 w-full rounded-full bg-muted overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                card.label === '全部任务'
                  ? 'bg-blue-500'
                  : card.label === '待处理'
                  ? 'bg-yellow-500'
                  : card.label === '进行中'
                  ? 'bg-purple-500'
                  : 'bg-green-500'
              }`}
              style={{
                width: stats.total > 0
                  ? `${(card.value / stats.total) * 100}%`
                  : '0%',
              }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
