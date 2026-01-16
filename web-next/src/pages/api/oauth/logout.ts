import type { NextApiRequest, NextApiResponse } from "next";

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader("Set-Cookie", [`access_token=; Path=/; Max-Age=0`]);
  res.json({ ok: true });
}
