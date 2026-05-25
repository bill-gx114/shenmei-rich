import { useCallback, useEffect, useState } from 'react';
import type { Tweaks } from '../lib/types';

const DEFAULTS: Tweaks = {
  narratorVoice: '清·克制',
  spotlight: 70,
  showHotspotsByDefault: true,
  frame: 'mat',
  textScale: 100,
};

const KEY = 'shenmei.tweaks.v1';

function load(): Tweaks {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return DEFAULTS;
    const parsed = JSON.parse(raw);
    return { ...DEFAULTS, ...parsed };
  } catch {
    return DEFAULTS;
  }
}

export function useTweaks(): [Tweaks, <K extends keyof Tweaks>(key: K, value: Tweaks[K]) => void] {
  const [values, setValues] = useState<Tweaks>(load);

  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(values));
    } catch {
      // ignore quota
    }
  }, [values]);

  const setTweak = useCallback(
    <K extends keyof Tweaks>(key: K, value: Tweaks[K]) => {
      setValues((prev) => ({ ...prev, [key]: value }));
    },
    [],
  );

  return [values, setTweak];
}

export { DEFAULTS as TWEAK_DEFAULTS };
