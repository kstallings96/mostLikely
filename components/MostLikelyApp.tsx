"use client";

import { useState } from "react";
import { startSession } from "@/lib/logger";
import { useSpinnerModel } from "@/lib/useSpinnerModel";
import LoadingScreen from "./LoadingScreen";
import PlayScreen from "./PlayScreen";
import StartScreen from "./StartScreen";

export default function MostLikelyApp() {
  const { model, state } = useSpinnerModel();
  const [teamCode, setTeamCode] = useState<string | null>(null);

  if (!teamCode) {
    return (
      <StartScreen
        modelState={state}
        onStart={(code) => {
          startSession(code);
          setTeamCode(code);
        }}
      />
    );
  }
  if (!model || state?.status !== "ready") return <LoadingScreen state={state} />;
  return <PlayScreen model={model} teamCode={teamCode} />;
}
