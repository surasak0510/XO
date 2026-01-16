import type { NextApiRequest, NextApiResponse } from "next";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL!;
  const r = await fetch(`${apiBase}/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(req.body),
  });

  const setCookie = r.headers.get("set-cookie");
  if (setCookie) res.setHeader("set-cookie", setCookie);

  res.status(r.status).send(await r.text());
}
