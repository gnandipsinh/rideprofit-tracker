import { createServerFn } from "@tanstack/react-start";

export const DEMO_EMAIL = "demo@eicher.app";
export const DEMO_PASSWORD = "DemoEicher#2026";

/**
 * Temporary demo access: makes sure a pre-confirmed demo account exists so the
 * app can be explored without email verification.
 */
export const ensureDemoUser = createServerFn({ method: "POST" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const { error } = await supabaseAdmin.auth.admin.createUser({
    email: DEMO_EMAIL,
    password: DEMO_PASSWORD,
    email_confirm: true,
    user_metadata: { full_name: "Demo User", mobile: "9000000000" },
  });

  if (error && !/already/i.test(error.message)) {
    // Account may already exist with a different password — reset it.
    const { data } = await supabaseAdmin.auth.admin.listUsers();
    const existing = data?.users?.find((u) => u.email === DEMO_EMAIL);
    if (existing) {
      await supabaseAdmin.auth.admin.updateUserById(existing.id, {
        password: DEMO_PASSWORD,
        email_confirm: true,
      });
    } else {
      throw new Error("Could not prepare the demo account");
    }
  }

  return { email: DEMO_EMAIL, password: DEMO_PASSWORD };
});
