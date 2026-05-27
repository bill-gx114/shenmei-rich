import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import type { Tweaks } from '../lib/types';

const DEFAULTS: Tweaks = {
  narratorVoice: '清·克制',
  ttsEngine: 'edge',
  voiceName: '',
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

type TweaksContextValue = {
  values: Tweaks;
  setTweak: <K extends keyof Tweaks>(key: K, value: Tweaks[K]) => void;
};

const TweaksContext = createContext<TweaksContextValue | null>(null);

/**
 * Wrap the app once near the root. Every `useTweaks()` call below it shares
 * the same state, so changes from the Tweaks panel propagate to every
 * consumer (artwork frame, audio guide, etc.) instantly — no page refresh.
 */
export function TweaksProvider({ children }: { children: ReactNode }) {
  const [values, setValues] = useState<Tweaks>(load);

  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(values));
    } catch {
      // ignore quota / private-mode errors
    }
  }, [values]);

  const setTweak = useCallback(
    <K extends keyof Tweaks>(key: K, value: Tweaks[K]) => {
      setValues((prev) => ({ ...prev, [key]: value }));
    },
    [],
  );

  return (
    <TweaksContext.Provider value={{ values, setTweak }}>{children}</TweaksContext.Provider>
  );
}

export function useTweaks(): [Tweaks, TweaksContextValue['setTweak']] {
  const ctx = useContext(TweaksContext);
  if (!ctx) {
    throw new Error('useTweaks must be used inside <TweaksProvider>');
  }
  return [ctx.values, ctx.setTweak];
}

export { DEFAULTS as TWEAK_DEFAULTS };
