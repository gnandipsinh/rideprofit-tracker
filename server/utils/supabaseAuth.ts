export interface SupabaseUser {
  id: string;
  email?: string;
}

export async function getSupabaseUser(accessToken: string): Promise<SupabaseUser | null> {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) throw new Error("Supabase auth configuration is missing");

  const response = await fetch(`${url}/auth/v1/user`, {
    headers: {
      apikey: key,
      Authorization: `Bearer ${accessToken}`,
    },
  });
  if (!response.ok) return null;
  return (await response.json()) as SupabaseUser;
}