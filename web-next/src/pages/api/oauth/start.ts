import type { NextApiRequest, NextApiResponse } from "next";
import crypto from "crypto";

function base64url(buf: Buffer) {
  return buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8080";

  const state = base64url(crypto.randomBytes(16));
  const verifier = base64url(crypto.randomBytes(32));
  const challenge = base64url(crypto.createHash("sha256").update(verifier).digest());

  res.setHeader("Set-Cookie", [
    `oauth_state=${state}; HttpOnly; Path=/; SameSite=Lax`,
    `oauth_verifier=${verifier}; HttpOnly; Path=/; SameSite=Lax`,
  ]);

  const params = new URLSearchParams({
    response_type: "code",
    client_id: "web-next",
    redirect_uri: "http://localhost:3000/oauth/callback",
    state,
    code_challenge: challenge,
    code_challenge_method: "S256",
  });

  res.redirect(`${apiBase}/oauth/authorize?${params.toString()}`);
}
