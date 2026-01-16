import type { NextApiRequest, NextApiResponse } from "next";

function getCookie(req: NextApiRequest, name: string) {
  const c = req.headers.cookie || "";
  const m = c.match(new RegExp(`${name}=([^;]+)`));
  return m ? decodeURIComponent(m[1]) : "";
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL!;
  const token = getCookie(req, "access_token");
  const userId = String(req.query.userId || "");

  console.log("[proxy/admin-user-history] userId:", userId, "token exists:", Boolean(token));

  if (!token) return res.status(401).send("no token");
  if (!userId) return res.status(400).send("missing userId");

  const r = await fetch(`${apiBase}/admin/users/${encodeURIComponent(userId)}/history`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  const text = await r.text();
  console.log("[proxy/admin-user-history] status:", r.status, "body:", text);
  res.status(r.status).send(text);
}
