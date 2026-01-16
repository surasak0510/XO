import Head from "next/dist/shared/lib/head";
import { useEffect, useMemo, useState } from "react";

type Player = "X" | "O";
type Cell = "" | Player;
type Result = "WIN" | "LOSE" | "DRAW";

type Move = { p: Player; i: number };

type HistoryItem = {
    id: number;
    result: Result;
    board_json: string; // JSON string of board
    created_at: string;
};

function calculateWinner(board: Cell[]): Player | null {
    const lines = [
        [0, 1, 2], [3, 4, 5], [6, 7, 8],
        [0, 3, 6], [1, 4, 7], [2, 5, 8],
        [0, 4, 8], [2, 4, 6],
    ];
    for (const [a, b, c] of lines) {
        if (board[a] && board[a] === board[b] && board[a] === board[c]) return board[a];
    }
    return null;
}

function emptyIndices(board: Cell[]) {
    const out: number[] = [];
    for (let i = 0; i < board.length; i++) if (board[i] === "") out.push(i);
    return out;
}

// bot: win -> block -> center -> random
function botPick(board: Cell[]): number | null {
    const empties = emptyIndices(board);
    if (empties.length === 0) return null;

    for (const i of empties) {
        const b = [...board];
        b[i] = "O";
        if (calculateWinner(b) === "O") return i;
    }

    for (const i of empties) {
        const b = [...board];
        b[i] = "X";
        if (calculateWinner(b) === "X") return i;
    }

    if (board[4] === "") return 4;

    return empties[Math.floor(Math.random() * empties.length)];
}

function parseBoardJson(boardJson: string): Cell[] | null {
    try {
        const arr = JSON.parse(boardJson);
        if (!Array.isArray(arr) || arr.length !== 9) return null;
        return arr.map((x) => (x === "X" || x === "O" ? x : "")) as Cell[];
    } catch {
        return null;
    }
}

export default function Game() {
    const [stats, setStats] = useState<{ score: number; streakWins: number } | null>(null);
    const [history, setHistory] = useState<HistoryItem[]>([]);
    const [err, setErr] = useState("");

    const [tab, setTab] = useState<"dashboard" | "history">("dashboard");

    const [board, setBoard] = useState<Cell[]>(Array(9).fill(""));
    const [moves, setMoves] = useState<Move[]>([]);
    const [locked, setLocked] = useState(false);

    const winner = useMemo(() => calculateWinner(board), [board]);
    const isDraw = useMemo(() => !winner && emptyIndices(board).length === 0, [winner, board]);
    const gameOver = Boolean(winner) || isDraw;

    async function refreshStats() {
        setErr("");
        const res = await fetch("/api/proxy/me-stats");
        const text = await res.text();
        console.log("[browser] /me-stats:", res.status, text);
        if (!res.ok) return setErr(text);
        setStats(JSON.parse(text));
    }

    async function refreshHistory() {
        setErr("");
        const res = await fetch("/api/proxy/me-history");
        const text = await res.text();
        console.log("[browser] /me-history:", res.status, text);
        if (!res.ok) return setErr(text);
        setHistory(JSON.parse(text));
    }

    async function submitResult(result: Result) {
        setErr("");
        const payload = {
            result,
            board: board.map((c) => c),
            moves,
        };

        console.log("[browser] submit payload:", payload);

        const res = await fetch("/api/proxy/submit", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
        });

        const text = await res.text();
        console.log("[browser] /submit:", res.status, text);

        if (!res.ok) return setErr(text);

        const d = JSON.parse(text);
        setStats({ score: d.newScore, streakWins: d.streakWins });

        await refreshHistory();
    }

    function resetGame() {
        setBoard(Array(9).fill(""));
        setMoves([]);
        setLocked(false);
        setErr("");
        console.log("[browser] reset game");
    }

    async function finalizeIfOver(nextBoard: Cell[]) {
        const w = calculateWinner(nextBoard);
        const draw = !w && emptyIndices(nextBoard).length === 0;
        if (!w && !draw) return;

        if (w === "X") await submitResult("WIN");
        else if (w === "O") await submitResult("LOSE");
        else await submitResult("DRAW");
    }

    async function onClickCell(i: number) {
        if (locked) return;
        if (board[i] !== "") return;
        if (gameOver) return;

        setLocked(true);

        const b1 = [...board];
        b1[i] = "X";
        const m1 = [...moves, { p: "X", i }];
        setBoard(b1);
        setMoves(m1);
        console.log("[browser] player X ->", i, b1);

        if (calculateWinner(b1) === "X" || emptyIndices(b1).length === 0) {
            await finalizeIfOver(b1);
            setLocked(false);
            return;
        }

        const pick = botPick(b1);
        if (pick === null) {
            await finalizeIfOver(b1);
            setLocked(false);
            return;
        }

        const b2 = [...b1];
        b2[pick] = "O";
        const m2 = [...m1, { p: "O", i: pick }];
        setBoard(b2);
        setMoves(m2);
        console.log("[browser] bot O ->", pick, b2);

        await finalizeIfOver(b2);
        setLocked(false);
    }

    async function logout() {
        await fetch("/api/oauth/logout");
        window.location.href = "/";
    }

    useEffect(() => {
        refreshStats();
        refreshHistory();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const statusText = winner
        ? winner === "X"
            ? "You win 🎉"
            : "Bot wins 🤖"
        : isDraw
            ? "Draw 😅"
            : locked
                ? "Bot thinking..."
                : "Your turn (X)";

    return (
        <main className="min-h-screen bg-gray-950 text-gray-50 flex items-center justify-center p-6">
            <Head>
                <title>Game | TIC-OX</title>
            </Head>
            <div className="w-full max-w-6xl grid gap-6 md:grid-cols-2">
                {/* Left: Game */}
                <div className="rounded-2xl bg-white/5 border border-white/10 p-6">
                    <div className="flex items-start justify-between gap-4">
                        <div>
                            <h1 className="text-2xl font-semibold">Tic-Tac-Toe</h1>
                            <p className="text-sm text-gray-300 mt-1">{statusText}</p>
                        </div>

                        <div className="flex gap-2">
                            <button
                                onClick={resetGame}
                                className="px-3 py-2 rounded-xl bg-white/10 hover:bg-white/15 border border-white/10 text-sm"
                            >
                                New Game
                            </button>
                            <button
                                onClick={() => { refreshStats(); refreshHistory(); }}
                                className="px-3 py-2 rounded-xl bg-white/10 hover:bg-white/15 border border-white/10 text-sm"
                            >
                                Refresh
                            </button>
                        </div>
                    </div>

                    <div className="mt-6 grid grid-cols-3 gap-3">
                        {board.map((c, i) => (
                            <button
                                key={i}
                                onClick={() => onClickCell(i)}
                                disabled={locked || c !== "" || gameOver}
                                className={`aspect-square rounded-2xl border text-4xl font-bold flex items-center justify-center
                  ${c === "X" ? "bg-indigo-500/15 border-indigo-400/30 text-indigo-200" : ""}
                  ${c === "O" ? "bg-rose-500/15 border-rose-400/30 text-rose-200" : ""}
                  ${c === "" ? "bg-white/5 border-white/10 hover:bg-white/10" : ""}
                  disabled:opacity-70 disabled:cursor-not-allowed transition`}
                            >
                                {c}
                            </button>
                        ))}
                    </div>

                    <div className="mt-5 flex flex-wrap items-center gap-2 text-xs text-gray-400">
                        <span className="px-2 py-1 rounded-full bg-indigo-500/10 border border-indigo-400/20 text-indigo-200">
                            You = X
                        </span>
                        <span className="px-2 py-1 rounded-full bg-rose-500/10 border border-rose-400/20 text-rose-200">
                            Bot = O
                        </span>
                        {gameOver ? (
                            <span className="px-2 py-1 rounded-full bg-emerald-500/10 border border-emerald-400/20 text-emerald-200">
                                Game Over
                            </span>
                        ) : null}
                    </div>

                    {err ? (
                        <div className="mt-4 rounded-xl border border-rose-400/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
                            {err}
                        </div>
                    ) : null}
                </div>

                {/* Right: Dashboard + History tabs */}
                <div className="rounded-2xl bg-white/5 border border-white/10 p-6">
                    <div className="flex items-start justify-between gap-4">
                        <div>
                            <h2 className="text-xl font-semibold">Panel</h2>
                            <p className="text-sm text-gray-300 mt-1">Score & your match history</p>
                        </div>

                        <div className="inline-flex rounded-xl bg-white/5 border border-white/10 p-1">
                            <button
                                onClick={() => setTab("dashboard")}
                                className={`px-3 py-1.5 rounded-lg text-sm transition ${tab === "dashboard" ? "bg-white/10 text-white" : "text-gray-300 hover:text-white"
                                    }`}
                            >
                                Dashboard
                            </button>
                            <button
                                onClick={() => setTab("history")}
                                className={`px-3 py-1.5 rounded-lg text-sm transition ${tab === "history" ? "bg-white/10 text-white" : "text-gray-300 hover:text-white"
                                    }`}
                            >
                                History
                            </button>
                        </div>


                        <button
                            onClick={logout}
                            className="px-3 py-2 rounded-xl bg-rose-500/15 hover:bg-rose-500/20 border border-rose-400/20 text-sm text-rose-100 ml-auto"
                        >
                            Logout
                        </button>
                    </div>

                    {tab === "dashboard" ? (
                        <div className="mt-6 grid grid-cols-2 gap-4">
                            <div className="rounded-2xl bg-white/5 border border-white/10 p-4">
                                <div className="text-sm text-gray-300">Score</div>
                                <div className="mt-1 text-3xl font-semibold">{stats?.score ?? "-"}</div>
                                <div className="mt-2 text-xs text-gray-400">WIN +1 / LOSE -1</div>
                            </div>

                            <div className="rounded-2xl bg-white/5 border border-white/10 p-4">
                                <div className="text-sm text-gray-300">Streak Wins</div>
                                <div className="mt-1 text-3xl font-semibold">{stats?.streakWins ?? "-"}</div>
                                <div className="mt-2 text-xs text-gray-400">3 wins → bonus +1 then reset</div>
                            </div>

                            <div className="col-span-2 rounded-2xl bg-white/5 border border-white/10 p-4">
                                <div className="text-sm text-gray-300">Tips</div>
                                <ul className="mt-2 text-xs text-gray-400 space-y-1 list-disc pl-5">
                                    <li>เมื่อเกมจบ ระบบจะ submit ผล และบันทึก match ลง SQLite</li>
                                    <li>ทุก action จะ log ที่ Browser Console และ Terminal (ผ่าน proxy routes)</li>
                                </ul>
                            </div>
                        </div>
                    ) : (
                        <div className="mt-6">
                            <div className="flex items-center justify-between">
                                <div className="text-sm text-gray-300">Your Matches (ล่าสุด 20 เกม)</div>
                                <button
                                    onClick={refreshHistory}
                                    className="px-3 py-2 rounded-xl bg-white/10 hover:bg-white/15 border border-white/10 text-sm"
                                >
                                    Refresh History
                                </button>
                            </div>

                            <div className="mt-3 space-y-3 max-h-[520px] overflow-auto pr-1">
                                {history.length === 0 ? (
                                    <div className="text-sm text-gray-400 rounded-xl bg-white/5 border border-white/10 p-4">
                                        ยังไม่มีประวัติการเล่น
                                    </div>
                                ) : (
                                    history.map((h) => {
                                        const b = parseBoardJson(h.board_json);
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

                                                {/* mini board */}
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
                                                                {c || ""}
                                                            </div>
                                                        ))}
                                                    </div>
                                                ) : (
                                                    <div className="mt-3 text-xs text-gray-500">board parse failed</div>
                                                )}
                                            </div>
                                        );
                                    })
                                )}
                            </div>
                        </div>
                    )}

                    {err ? (
                        <div className="mt-4 rounded-xl border border-rose-400/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
                            {err}
                        </div>
                    ) : null}

                </div>
            </div>
        </main>
    );
}
