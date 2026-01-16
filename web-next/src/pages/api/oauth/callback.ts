import type { NextApiRequest, NextApiResponse } from "next";

function getCookie(req: NextApiRequest, name: string) {
  const c = req.headers.cookie || "";
  const m = c.match(new RegExp(`${name}=([^;]+)`));
  return m ? decodeURIComponent(m[1]) : "";
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8080";

  const code = String(req.query.code || "");
  const state = String(req.query.state || "");

  const savedState = getCookie(req, "oauth_state");
  const verifier = getCookie(req, "oauth_verifier");

  console.log("[api/oauth/callback] query state:", state);
  console.log("[api/oauth/callback] cookie state:", savedState);
  console.log("[api/oauth/callback] verifier exists:", Boolean(verifier));

  if (!code) return res.status(400).send("missing code");
  if (!state || !savedState || state !== savedState || !verifier) {
    return res.status(400).send("state/verifier missing or mismatch");
  }

  const tokenRes = await fetch(`${apiBase}/oauth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      client_id: "web-next",
      redirect_uri: "http://localhost:3000/oauth/callback",
      code_verifier: verifier,
    }),
  });

  const text = await tokenRes.text();
  console.log("[api/oauth/callback] token status:", tokenRes.status, "body:", text);

  if (!tokenRes.ok) return res.status(400).send(text);

  const data = JSON.parse(text);

  // set access token cookie + clear pkce cookies
  res.setHeader("Set-Cookie", [
    `access_token=${encodeURIComponent(data.access_token)}; HttpOnly; Path=/; SameSite=Lax`,
    `oauth_state=; Path=/; Max-Age=0`,
    `oauth_verifier=; Path=/; Max-Age=0`,
  ]);

  res.status(200).send("ok");
}
