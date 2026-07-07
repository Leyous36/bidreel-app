import { decode } from "base64-arraybuffer";
import { supabase } from "./supabase";

/**
 * Uploads a studio logo (from an image picker's base64) to the public
 * `studio-logos` bucket under the user's own folder, saves the public URL to
 * their profile, and returns it. The client-facing proposal page reads
 * `profiles.logo_url` to brand the page.
 */
export async function uploadStudioLogo(
  userId: string,
  base64: string,
): Promise<string> {
  const path = `${userId}/logo-${Date.now()}.png`;

  const { error: upErr } = await supabase.storage
    .from("studio-logos")
    .upload(path, decode(base64), {
      contentType: "image/png",
      upsert: true,
    });
  if (upErr) throw new Error(upErr.message);

  const { data } = supabase.storage.from("studio-logos").getPublicUrl(path);
  const url = data.publicUrl;

  const { error: profErr } = await supabase
    .from("profiles")
    .update({ logo_url: url })
    .eq("id", userId);
  if (profErr) throw new Error(profErr.message);

  return url;
}
