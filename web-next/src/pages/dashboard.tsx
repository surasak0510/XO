import Head from "next/dist/shared/lib/head";
import { useEffect, useMemo, useState } from "react";

type Me = { userID: number; role: string; username?: string };
type Row = { id: number; username: string; role: string; score: number; streakWins: number; updatedAt: string };
type HistoryItem = { id: number; result: "WIN" | "LOSE" | "DRAW"; board_json: string; created_at: string };

function parseBoard(boardJson: string): string[] | null {
    try {
        const arr = JSON.parse(boardJson);
        if (!Array.isArray(arr) || arr.length !== 9) return null;
        return arr.map((x) => (x === "X" || x === "O" ? x : ""));
    } catch {
        return null;
    }
}

export default function Dashboard() {
    const [me, setMe] = useState<Me | null>(null);
    const [all, setAll] = useState<Row[]>([]);
    const [selected, setSelected] = useState<Row | null>(null);
    const [history, setHistory] = useState<HistoryItem[]>([]);
    const [err, setErr] = useState("");

    const isAdmin = useMemo(() => me?.role === "admin", [me]);

    async function loadMe() {
        setErr("");
        const res = await fetch("/api/proxy/me");
        const text = await res.text();
        console.log("[browser] /me:", res.status, text);
        if (!res.ok) {
            setErr(text);
            return null;
        }
        const d = JSON.parse(text);
        setMe(d);
        return d as Me;
    }

    async function loadAllScores() {
        setErr("");
        const res = await fetch("/api/proxy/admin-scores");
        const text = await res.text();
        console.log("[browser] /admin-scores:", res.status, text);
        if (!res.ok) return setErr(text);
        setAll(JSON.parse(text));
    }

    async function loadUserHistory(userId: number) {
        setErr("");
        const res = await fetch(`/api/proxy/admin-user-history?userId=${userId}`);
        const text = await res.text();
        console.log("[browser] /admin-user-history:", res.status, text);
        if (!res.ok) return setErr(text);
        setHistory(JSON.parse(text));
    }

    async function logout() {
        await fetch("/api/oauth/logout");
        window.location.href = "/";
    }

    useEffect(() => {
        (async () => {
            const m = await loadMe();
            if (!m) return;

            // ถ้าไม่ใช่ admin ให้เด้งไป /game
            if (m.role !== "admin") {
                window.location.href = "/game";
                return;
            }

            await loadAllScores();
        })();
    }, []);

    return (

        <main className="min-h-screen bg-gray-950 text-gray-50 p-6">
            <Head>
                <title>Dashboard | TIC-OX</title>
            </Head>
            <div className="max-w-6xl mx-auto">
                <div className="flex items-start justify-between gap-4">
                    <div>
                        <h1 className="text-2xl font-semibold">Admin Dashboard</h1>
                        <p className="text-sm text-gray-300 mt-1">
                            Logged in as: <span className="font-mono">{me?.username ?? "-"}</span> | role:{" "}
                            <span className="font-mono">{me?.role ?? "-"}</span>
                        </p>
                    </div>

                    <div className="flex gap-2">
                        <button
                            onClick={loadAllScores}
                            className="px-3 py-2 rounded-xl bg-white/10 hover:bg-white/15 border border-white/10 text-sm"
                        >
                            Refresh Users
                        </button>
                        <button
                            onClick={async () => {
                                if (selected) await loadUserHistory(selected.id);
                            }}
                            disabled={!selected}
                            className="px-3 py-2 rounded-xl bg-white/10 hover:bg-white/15 border border-white/10 text-sm disabled:opacity-50"
                        >
                            Refresh History
                        </button>
                        <button
                            onClick={logout}
                            className="px-3 py-2 rounded-xl bg-rose-500/15 hover:bg-rose-500/20 border border-rose-400/20 text-sm text-rose-100 ml-auto"
                        >
                            Logout
                        </button>
                    </div>
                </div>

                {err ? (
                    <div className="mt-4 rounded-xl border border-rose-400/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
                        {err}
                    </div>
                ) : null}

                {!isAdmin ? (
                    <div className="mt-8 text-sm text-gray-300">
                        Checking admin permission...
                    </div>
                ) : (
                    <div className="mt-6 grid gap-6 md:grid-cols-2">
                        {/* Left: Users table */}
                        <div className="rounded-2xl bg-white/5 border border-white/10 overflow-hidden">
                            <div className="px-4 py-3 border-b border-white/10">
                                <div className="text-sm text-gray-300">Users & Scores</div>
                                <div className="text-xs text-gray-500">คลิกผู้เล่นเพื่อดูประวัติการเล่นด้านขวา</div>
                            </div>

                            <div className="overflow-auto max-h-[560px]">
                                <table className="min-w-full text-sm">
                                    <thead className="bg-white/5 text-gray-300 sticky top-0">
                                        <tr>
                                            <th className="text-left px-4 py-3">ID</th>
                                            <th className="text-left px-4 py-3">Username</th>
                                            <th className="text-left px-4 py-3">Role</th>
                                            <th className="text-right px-4 py-3">Score</th>
                                            <th className="text-right px-4 py-3">Streak</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-white/10">
                                        {all.map((r) => {
                                            const active = selected?.id === r.id;
                                            return (
                                                <tr
                                                    key={r.id}
                                                    onClick={async () => {
                                                        setSelected(r);
                                                        await loadUserHistory(r.id);
                                                    }}
                                                    className={`cursor-pointer ${active ? "bg-white/10" : "hover:bg-white/5"}`}
                                                >
                                                    <td className="px-4 py-3">{r.id}</td>
                                                    <td className="px-4 py-3">{r.username}</td>
                                                    <td className="px-4 py-3">{r.role}</td>
                                                    <td className="px-4 py-3 text-right font-semibold">{r.score}</td>
                                                    <td className="px-4 py-3 text-right">{r.streakWins}</td>
                                                </tr>
                                            );
                                        })}
                                        {all.length === 0 ? (
                                            <tr>
                                                <td className="px-4 py-6 text-gray-400" colSpan={5}>
                                                    No users found.
                                                </td>
                                            </tr>
                                        ) : null}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        {/* Right: Selected user's history */}
                        <div className="rounded-2xl bg-white/5 border border-white/10 overflow-hidden">
                            <div className="px-4 py-3 border-b border-white/10">
                                <div className="text-sm text-gray-300">Match History</div>
                                <div className="text-xs text-gray-500">
                                    {selected ? (
                                        <>
                                            User: <span className="font-mono">{selected.username}</span> (id {selected.id})
                                        </>
                                    ) : (
                                        "เลือกผู้เล่นทางซ้าย"
                                    )}
                                </div>
                            </div>

                            <div className="p-4">
                                {!selected ? (
                                    <div className="text-sm text-gray-400">คลิกผู้เล่น 1 คนเพื่อดูประวัติ</div>
                                ) : history.length === 0 ? (
                                    <div className="text-sm text-gray-400">ไม่มีประวัติการเล่น</div>
                                ) : (
                                    <div className="space-y-3 max-h-[560px] overflow-auto pr-1">
                                        {history.map((h) => {
                                            const b = parseBoard(h.board_json);
                                            const badge =
                                                h.result === "WIN"
                                                    ? "bg-emerald-500/10 border-emerald-400/20 text-emerald-200"
                                                    : h.result === "LOSE"
                                                        ? "bg-rose-500/10 border-rose-400/20 text-rose-200"
                                                        : "bg-gray-500/10 border-gray-400/20 text-gray-200";

                                            return (
                                                <div key={h.id} className="rounded-2xl bg-white/5 border border-white/10 p-4">
                                                    <div className="flex items-center justify-between gap-3">
                                                        <div className="text-sm">
                                                            <span className={`inline-flex items-center px-2 py-1 rounded-full border text-xs ${badge}`}>
                                                                {h.result}
                                                            </span>
                                                            <span className="ml-2 text-xs text-gray-400">#{h.id}</span>
                                                        </div>
                                                        <div className="text-xs text-gray-400">{h.created_at}</div>
                                                    </div>

                                                    {b ? (
                                                        <div className="mt-3 grid grid-cols-3 gap-1 w-32">
                                                            {b.map((c, idx) => (
                                                                <div
                                                                    key={idx}
                                                                    className={`aspect-square rounded-lg border flex items-center justify-center text-sm font-semibold
                                    ${c === "X" ? "bg-indigo-500/15 border-indigo-400/30 text-indigo-200" : ""}
                                    ${c === "O" ? "bg-rose-500/15 border-rose-400/30 text-rose-200" : ""}
                                    ${c === "" ? "bg-white/5 border-white/10 text-gray-500" : ""}`}
                                                                >
                                                                    {c}
                                                                </div>
                                                            ))}
                                                        </div>
                                                    ) : (
                                                        <div className="mt-3 text-xs text-gray-500">board parse failed</div>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                <p className="mt-4 text-xs text-gray-400">
                    ทุกครั้งที่กดจะ log ที่ Browser Console และ Terminal (ผ่าน proxy routes).
                </p>
            </div>
        </main>
    );
}
