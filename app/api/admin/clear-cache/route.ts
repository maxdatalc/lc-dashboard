import { NextResponse } from "next/server";
import { Redis } from "@upstash/redis";

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

export async function POST(request: Request) {
  const { lojaId } = (await request.json()) as { lojaId?: string };

  // Listar todas as chaves e deletar as relacionadas à loja
  const keys = await redis.keys("*");
  console.log("[clear-cache] lojaId:", lojaId);
  console.log("[clear-cache] Todas as chaves Redis:", keys);

  // Deletar todas as chaves (reset completo do cache)
  if (keys.length > 0) {
    await redis.del(...keys);
  }

  return NextResponse.json({
    deletadas: keys.length,
    chaves: keys,
  });
}
