import { config } from "dotenv";

// Em CI, as variáveis já vêm do ambiente (GitHub Secrets) e este arquivo não
// encontra `.env.local` — dotenv.config() com arquivo ausente não lança erro.
config({ path: ".env.local" });
