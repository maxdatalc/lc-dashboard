import { NextResponse } from "next/server";
import { Redis } from "@upstash/redis";
import { createClient } from "@/lib/supabase/server";
import { isSystemAdmin } from "@/lib/db/admin";

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

export async function POST(_request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const admin = await isSystemAdmin(user.id);
  if (!admin) return NextResponse.json({ error: "Acesso negado" }, { status: 403 });

  const keys = await redis.keys("*");
  if (keys.length > 0) {
    await redis.del(...keys);
  }

  return NextResponse.json({ deletadas: keys.length });
}
