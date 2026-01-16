/* eslint-disable @typescript-eslint/no-explicit-any */
import Head from "next/dist/shared/lib/head";
import { useMemo, useState } from "react";

type Mode = "login" | "register";

export default function Home() {
    const [mode, setMode] = useState<Mode>("login");
    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");
    const [message, setMessage] = useState<string>("");
    const [loading, setLoading] = useState(false);

    const isLogin = useMemo(() => mode === "login", [mode]);

    async function submit() {
        setLoading(true);
        setMessage("");

        const url = isLogin ? "/api/proxy/login" : "/api/proxy/register";

        try {
            const res = await fetch(url, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ username, password }),
            });

            const text = await res.text();

            if (!res.ok) {
                setMessage(text || "Request failed");
                return;
            }

            if (isLogin) {

                window.location.href = "/api/oauth/start";
                setMessage("✅ Login success. Click Start OAuth");
            } else {
                setMessage("✅ Register success. Please login");
                setMode("login");
                setPassword("");
            }
        } catch (e: any) {
            setMessage(e?.message || "Failed to fetch");
        } finally {
            setLoading(false);
        }
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-indigo-600 via-violet-600 to-fuchsia-600 flex items-center justify-center px-4">
            <Head>
                <title>Login | TIC-OX</title>
            </Head>
            <div className="w-full max-w-md">
                <div className="rounded-2xl bg-white/95 backdrop-blur shadow-2xl border border-white/30 overflow-hidden">
                    <div className="px-6 pt-8 pb-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <h1 className="text-2xl font-semibold text-gray-900">OX Game</h1>
                                <p className="text-sm text-gray-600 mt-1">
                                    {isLogin ? "Login to continue" : "Create a new account"}
                                </p>
                            </div>

                            <span className="text-xs font-medium px-2 py-1 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-100">
                                OAuth2 + PKCE
                            </span>
                        </div>

                        <div className="mt-6 space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700">Username</label>
                                <input
                                    className="mt-1 w-full rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-gray-900 shadow-sm outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                                    value={username}
                                    onChange={(e) => setUsername(e.target.value)}
                                    placeholder="username"
                                    autoComplete="username"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700">Password</label>
                                <input
                                    className="mt-1 w-full rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-gray-900 shadow-sm outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                                    type="password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    placeholder="password"
                                    autoComplete={isLogin ? "current-password" : "new-password"}
                                />
                            </div>

                            {message ? (
                                <div
                                    className={`rounded-xl px-4 py-3 text-sm border ${message.startsWith("✅")
                                        ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                                        : "bg-rose-50 text-rose-800 border-rose-200"
                                        }`}
                                >
                                    {message}
                                </div>
                            ) : null}

                            <button
                                onClick={submit}
                                disabled={loading}
                                className="w-full rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-2.5 shadow-sm disabled:opacity-60 disabled:cursor-not-allowed transition"
                            >
                                {loading ? "Processing..." : isLogin ? "Login" : "Register"}
                            </button>

                            <button
                                onClick={() => setMode(isLogin ? "register" : "login")}
                                className="w-full text-sm text-indigo-700 hover:text-indigo-800 font-medium"
                            >
                                {isLogin ? "No account? Create one" : "Already have an account? Login"}
                            </button>

                            <div className="pt-2 text-xs text-gray-500">
                                Demo users: <span className="font-mono">admin/admin123</span> (admin),{" "}
                                <span className="font-mono">user/user123</span>
                            </div>
                        </div>
                    </div>

                    <div className="px-6 py-4 bg-gray-50 border-t border-gray-200">
                        <p className="text-xs text-gray-600">
                            Tip: After login → click <span className="font-semibold">Start OAuth</span> → go to{" "}
                            <span className="font-mono">/game</span>.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}
