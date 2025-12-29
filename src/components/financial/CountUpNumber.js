'use client';

import { useEffect, useRef } from 'react';

export default function CountUpNumber({ value, duration = 2 }) {
  const elementRef = useRef(null);
  const startValueRef = useRef(0);
  const endValueRef = useRef(value);

  useEffect(() => {
    const element = elementRef.current;
    if (!element) return;

    const startTime = Date.now();
    const startValue = startValueRef.current;
    const endValue = endValueRef.current;

    const updateCount = () => {
      const now = Date.now();
      const elapsed = (now - startTime) / 1000;
      const progress = Math.min(elapsed / duration, 1);

      const currentValue = Math.floor(
        startValue + (endValue - startValue) * progress
      );

      element.textContent = currentValue.toLocaleString('en-US');

      if (progress < 1) {
        requestAnimationFrame(updateCount);
      }
    };

    const animationId = requestAnimationFrame(updateCount);

    return () => cancelAnimationFrame(animationId);
  }, [value, duration]);

  useEffect(() => {
    startValueRef.current = endValueRef.current;
    endValueRef.current = value;
  }, [value]);

  return <span ref={elementRef}>0</span>;
}
