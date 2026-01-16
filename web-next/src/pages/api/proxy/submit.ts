import type { NextApiRequest, NextApiResponse } from "next";

function getCookie(req: NextApiRequest, name: string) {
  const c = req.headers.cookie || "";
  const m = c.match(new RegExp(`${name}=([^;]+)`));
  return m ? decodeURIComponent(m[1]) : "";
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL!;
  const token = getCookie(req, "access_token");

  console.log("[proxy/submit] payload:", req.body);
  console.log("[proxy/submit] cookie access_token exists:", Boolean(token));

  if (!token) return res.status(401).send("no token");

  const r = await fetch(`${apiBase}/game/submit`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(req.body),
  });

  const text = await r.text();
  console.log("[proxy/submit] status:", r.status, "body:", text);

  res.status(r.status).send(text);
}
