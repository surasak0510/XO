/* eslint-disable @typescript-eslint/no-explicit-any */
import Head from "next/dist/shared/lib/head";
import { useEffect, useState } from "react";

export default function OAuthCallbackPage() {
  const [msg, setMsg] = useState("Finishing login...");

  useEffect(() => {
    (async () => {
      try {
        // เรียก API callback เพื่อแลก code -> token และ set cookie
        const res = await fetch("/api/oauth/callback" + window.location.search, {
          method: "GET",
          credentials: "include",
        });
        const text = await res.text();
        console.log("[oauth/callback page] api result:", res.status, text);

        if (!res.ok) {
          setMsg(text || "OAuth callback failed");
          return;
        }

        // เช็ค role แล้ว redirect
        const meRes = await fetch("/api/proxy/me", { credentials: "include" });
        const meText = await meRes.text();
        console.log("[oauth/callback page] me:", meRes.status, meText);

        if (!meRes.ok) {
          setMsg(meText || "Cannot read /me");
          return;
        }

        const me = JSON.parse(meText);
        window.location.href = me.role === "admin" ? "/dashboard" : "/game";
      } catch (e: any) {
        setMsg(e?.message || "Unexpected error");
      }
    })();
  }, []);

  return (
    <main className="min-h-screen bg-gray-950 text-gray-50 flex items-center justify-center p-6">
      <Head>
        <title>Procress | TIC-OX</title>
      </Head>
      <div className="rounded-2xl bg-white/5 border border-white/10 p-6 max-w-md w-full">
        <h1 className="text-xl font-semibold">OAuth Callback</h1>
        <p className="text-sm text-gray-300 mt-2">{msg}</p>
      </div>
    </main>
  );
}
