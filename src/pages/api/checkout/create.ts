// Creates a Dodo Payments checkout session server-side (the API key can't
// live in browser code). No database involved: the client hangs onto the
// returned sessionId itself and re-verifies it live against Dodo's API at
// export time -- see verify.ts.
export const prerender = false;

import type { APIRoute } from "astro";
import { getDodoClient, getProProductId, jsonResponse } from "../../../lib/server/dodo";

export const POST: APIRoute = async ({ request }) => {
  const client = getDodoClient();
  const productId = getProProductId();
  if (!client || !productId) {
    console.error("Dodo Payments not configured (missing API key or product id).");
    return jsonResponse({ error: "Payments aren't set up yet -- check back soon." }, 500);
  }

  const origin = new URL(request.url).origin;
  try {
    const session = await client.checkoutSessions.create({
      product_cart: [{ product_id: productId, quantity: 1 }],
      return_url: `${origin}/pricing?checkout=return`,
    });
    // Confirmed against the SDK's CheckoutSessionResponse type: the id field
    // is session_id (not id -- that's only on the *retrieve* response shape).
    return jsonResponse({
      checkoutUrl: session.checkout_url,
      sessionId: session.session_id,
    });
  } catch (err) {
    console.error("Dodo checkout session creation failed:", err);
    return jsonResponse({ error: "Couldn't start checkout. Please try again." }, 502);
  }
};
