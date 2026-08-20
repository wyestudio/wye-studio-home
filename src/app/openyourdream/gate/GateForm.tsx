"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { verifyGateCode } from "./actions";

export function GateForm({ redirectTo }: { redirectTo: string }) {
  const router = useRouter();
  const [seg1, setSeg1] = useState("");
  const [seg2, setSeg2] = useState("");
  const [error, setError] = useState("");
  const [isVerifying, setIsVerifying] = useState(false);
  const seg2Ref = useRef<HTMLInputElement>(null);

  function handleSeg1Change(raw: string) {
    const digits = raw.replace(/[^0-9]/g, "").slice(0, 4);
    setSeg1(digits);
    setError("");
    if (digits.length === 4) seg2Ref.current?.focus();
  }

  function handleSeg2Change(raw: string) {
    const digits = raw.replace(/[^0-9]/g, "").slice(0, 4);
    setSeg2(digits);
    setError("");
    if (digits.length === 4) {
      void submit(seg1 + digits);
    }
  }

  function handleSeg2KeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Backspace" && seg2 === "") {
      document.getElementById("oyd-gate-seg1")?.focus();
    }
  }

  async function submit(code: string) {
    setIsVerifying(true);
    try {
      const result = await verifyGateCode(code);
      if (result.error) {
        setError(result.error);
        setSeg1("");
        setSeg2("");
        document.getElementById("oyd-gate-seg1")?.focus();
      } else {
        router.push(redirectTo);
      }
    } catch {
      setError("오류가 발생했습니다. 잠시 후 다시 시도해주세요.");
    } finally {
      setIsVerifying(false);
    }
  }

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="flex items-center gap-2 text-xl text-white">
        <span>☎</span>
        <span>02-</span>
        <input
          id="oyd-gate-seg1"
          type="tel"
          inputMode="numeric"
          autoComplete="off"
          maxLength={4}
          value={seg1}
          disabled={isVerifying}
          onChange={(e) => handleSeg1Change(e.target.value)}
          className="w-24 rounded-md border border-white/30 bg-white/5 px-2 py-1 text-center tracking-widest text-white outline-none focus:border-white disabled:opacity-50"
          placeholder="0000"
        />
        <span>-</span>
        <input
          ref={seg2Ref}
          type="tel"
          inputMode="numeric"
          autoComplete="off"
          maxLength={4}
          value={seg2}
          disabled={isVerifying}
          onChange={(e) => handleSeg2Change(e.target.value)}
          onKeyDown={handleSeg2KeyDown}
          className="w-24 rounded-md border border-white/30 bg-white/5 px-2 py-1 text-center tracking-widest text-white outline-none focus:border-white disabled:opacity-50"
          placeholder="0000"
        />
      </div>
      {error ? <div className="text-sm text-red-400">{error}</div> : null}
    </div>
  );
}
