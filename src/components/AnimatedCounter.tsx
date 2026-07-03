'use client';

import { useState, useCallback, useRef, useEffect } from 'react';

interface AnimatedCounterProps {
  /** 初始值 */
  initialValue?: number;
  /** 最小值 */
  min?: number;
  /** 最大值 */
  max?: number;
  /** 步长 */
  step?: number;
  /** 数值变化回调 */
  onChange?: (value: number) => void;
  /** 动画时长(ms) */
  duration?: number;
}

export default function AnimatedCounter({
  initialValue = 0,
  min = -Infinity,
  max = Infinity,
  step = 1,
  onChange,
  duration = 300,
}: AnimatedCounterProps) {
  const [value, setValue] = useState(initialValue);
  const [animClass, setAnimClass] = useState('');
  const prevValueRef = useRef(initialValue);
  const timerRef = useRef<ReturnType<typeof setTimeout>>();

  const updateValue = useCallback(
    (next: number) => {
      const clamped = Math.min(max, Math.max(min, next));
      if (clamped === value) return;

      // 触发弹跳动画
      const direction = clamped > value ? 'bounce-up' : 'bounce-down';
      setAnimClass(direction);
      clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => setAnimClass(''), duration);

      prevValueRef.current = value;
      setValue(clamped);
      onChange?.(clamped);
    },
    [value, min, max, duration, onChange],
  );

  const increment = useCallback(() => updateValue(value + step), [updateValue, value, step]);
  const decrement = useCallback(() => updateValue(value - step), [updateValue, value, step]);
  const reset = useCallback(() => updateValue(initialValue), [updateValue, initialValue]);

  useEffect(() => () => clearTimeout(timerRef.current), []);

  return (
    <div style={styles.wrapper}>
      <div style={styles.container}>
        <span style={styles.label}>计数器</span>

        <div style={styles.display}>
          {/* 旧数值 — 飞走 */}
          <span
            key={`old-${value}`}
            style={{
              ...styles.digit,
              ...styles.digitOld,
              animation: animClass
                ? `${animClass}-old ${duration}ms ease-in forwards`
                : 'none',
            }}
          >
            {prevValueRef.current}
          </span>

          {/* 新数值 — 飞入 */}
          <span
            key={`new-${value}`}
            style={{
              ...styles.digit,
              ...styles.digitNew,
              animation: animClass
                ? `${animClass}-new ${duration}ms ease-out forwards`
                : 'none',
            }}
          >
            {value}
          </span>
        </div>

        <div style={styles.actions}>
          <button onClick={decrement} style={styles.btn} disabled={value <= min}>
            −{step}
          </button>
          <button onClick={reset} style={{ ...styles.btn, ...styles.btnReset }}>
            重置
          </button>
          <button onClick={increment} style={styles.btn} disabled={value >= max}>
            +{step}
          </button>
        </div>
      </div>

      <style>{`
        @keyframes bounce-up-old {
          0%   { opacity: 1; transform: translateY(0) scale(1); }
          100% { opacity: 0; transform: translateY(-120%) scale(0.6); }
        }
        @keyframes bounce-up-new {
          0%   { opacity: 0; transform: translateY(120%) scale(0.6); }
          60%  { opacity: 1; transform: translateY(-8%)  scale(1.05); }
          100% { opacity: 1; transform: translateY(0)     scale(1); }
        }
        @keyframes bounce-down-old {
          0%   { opacity: 1; transform: translateY(0)     scale(1); }
          100% { opacity: 0; transform: translateY(120%)  scale(0.6); }
        }
        @keyframes bounce-down-new {
          0%   { opacity: 0; transform: translateY(-120%) scale(0.6); }
          60%  { opacity: 1; transform: translateY(8%)    scale(1.05); }
          100% { opacity: 1; transform: translateY(0)     scale(1); }
        }
      `}</style>
    </div>
  );
}

/* ── 内联样式 ── */
const styles: Record<string, React.CSSProperties> = {
  wrapper: { fontFamily: 'system-ui, sans-serif' },
  container: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 20,
    padding: '32px 40px',
    borderRadius: 16,
    background: 'linear-gradient(135deg, #1e1e2e 0%, #2a2a3e 100%)',
    color: '#fff',
    boxShadow: '0 8px 32px rgba(0,0,0,0.35)',
  },
  label: {
    fontSize: 14,
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: 2,
    color: '#a0a0c0',
  },
  display: {
    position: 'relative',
    width: 120,
    height: 72,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    fontSize: 48,
    fontWeight: 700,
    background: 'rgba(0,0,0,0.3)',
    borderRadius: 12,
    border: '1px solid rgba(255,255,255,0.08)',
  },
  digit: {
    position: 'absolute',
    userSelect: 'none',
  },
  digitOld: { color: '#ff6b6b' },
  digitNew: { color: '#51cf66' },
  actions: { display: 'flex', gap: 10 },
  btn: {
    padding: '8px 20px',
    border: '1px solid rgba(255,255,255,0.15)',
    borderRadius: 8,
    background: 'rgba(255,255,255,0.06)',
    color: '#fff',
    fontSize: 14,
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'background 0.2s, opacity 0.2s',
  },
  btnReset: { background: 'rgba(255,255,255,0.12)' },
};
