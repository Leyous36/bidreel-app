// BidReel — shared push helper. Sends a notification to a producer's device via
// the Expo push service. Failures are swallowed: a missing/expired token must
// never break the request that triggered it.

// Minimal structural type so we don't need to import the full client type.
interface Admin {
  // deno-lint-ignore no-explicit-any
  from: (table: string) => any;
}

export async function pushToProducer(
  admin: Admin,
  userId: string,
  title: string,
  body: string,
  data: Record<string, unknown> = {},
): Promise<void> {
  try {
    const { data: prof } = await admin
      .from("profiles")
      .select("push_token")
      .eq("id", userId)
      .single();

    const token: string | undefined = prof?.push_token;
    if (!token || !token.startsWith("ExponentPushToken")) return;

    await fetch("https://exp.host/--/api/v2/push/send", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Accept": "application/json" },
      body: JSON.stringify({
        to: token,
        title,
        body,
        sound: "default",
        priority: "high",
        data,
      }),
    });
  } catch (_e) {
    // Never let a push failure surface to the caller.
  }
}
