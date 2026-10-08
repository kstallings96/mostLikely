"use client";

import { useEffect, useRef, useState } from "react";
import { logEvent, recoverUnsent, startSession } from "@/lib/logger";
import { useSpinnerModel } from "@/lib/useSpinnerModel";
import LoadingScreen from "./LoadingScreen";
import PlayScreen from "./PlayScreen";
import StartScreen from "./StartScreen";

export default function MostLikelyApp() {
  const { model, state } = useSpinnerModel();
  const [player, setPlayer] = useState<string | null>(null);
  const loggedModel = useRef(false);

  // Send anything a previous visit on this device left unsent.
  useEffect(() => {
    void recoverUnsent();
  }, []);

  // Record how the model loaded on this device (answers "can school laptops
  // handle it?"). Kept until Start is pressed if it happens before.
  useEffect(() => {
    if (loggedModel.current || !state || state.status === "loading") return;
    loggedModel.current = true;
    const nav = navigator as Navigator & { deviceMemory?: number };
    const device = { device_memory_gb: nav.deviceMemory ?? null, cpu_cores: nav.hardwareConcurrency ?? null };
    if (state.status === "ready") {
      logEvent({
        round: "start",
        event_type: "model_ready",
        detail: { load_ms: state.info.loadMs, model: state.info.dtype, ...device },
      });
    } else {
      logEvent({ round: "start", event_type: "error", detail: { where: "model_load", message: state.message, ...device } });
    }
  }, [state]);

  if (!player) {
    return (
      <StartScreen
        modelState={state}
        onStart={(first, initial) => {
          startSession(first, initial);
          setPlayer(`${first} ${initial}.`);
        }}
      />
    );
  }
  if (!model || state?.status !== "ready") return <LoadingScreen state={state} />;
  return <PlayScreen model={model} player={player} />;
}
