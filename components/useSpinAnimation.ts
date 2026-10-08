"use client";

import { useEffect, useRef, useState } from "react";
import { GAME } from "@/config/game";
import type { SpinResult } from "@/lib/sample";

/**
 * Reveals spin results one at a time over ~GAME.spinAnimationMs, so the
 * histogram fills up live. `skip()` shows everything at once. `onDone`
 * fires once per set, whether it finished or was skipped.
 */
export function useSpinAnimation(onDone: (results: SpinResult[], skipped: boolean) => void) {
  const [results, setResults] = useState<SpinResult[] | null>(null);
  const [revealed, setRevealed] = useState(0);
  const skippedRef = useRef(false);
  const doneRef = useRef(onDone);
  useEffect(() => {
    doneRef.current = onDone;
  });

  useEffect(() => {
    if (!results || revealed >= results.length) return;
    // Bigger sets drop faster so every set takes about the same time.
    const step = Math.max(40, GAME.spinAnimationMs / results.length);
    const t = setTimeout(() => setRevealed((r) => r + 1), revealed === 0 ? 150 : step);
    return () => clearTimeout(t);
  }, [results, revealed]);

  useEffect(() => {
    if (results && revealed === results.length) doneRef.current(results, skippedRef.current);
  }, [results, revealed]);

  return {
    results,
    revealed,
    spinning: !!results && revealed < results.length,
    start(r: SpinResult[]) {
      skippedRef.current = false;
      setRevealed(0);
      setResults(r);
    },
    skip() {
      if (!results) return;
      skippedRef.current = true;
      setRevealed(results.length);
    },
    clear() {
      setResults(null);
      setRevealed(0);
    },
  };
}
