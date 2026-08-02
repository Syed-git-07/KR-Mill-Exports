'use client';

import { useEffect } from 'react';

/**
 * Prevent browsers from changing a focused number input when the mouse wheel
 * is used over it. Blurring preserves the wheel's normal page/table scroll.
 */
export default function DisableNumberInputWheel() {
  useEffect(() => {
    const disableWheelIncrement = (event) => {
      const target = event.target;
      if (target instanceof HTMLInputElement && target.type === 'number') {
        target.blur();
      }
    };

    window.addEventListener('wheel', disableWheelIncrement, { capture: true });
    return () => window.removeEventListener('wheel', disableWheelIncrement, { capture: true });
  }, []);

  return null;
}
