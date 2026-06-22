-- Adiciona coluna CNPJ às lojas
-- Execute no Supabase SQL Editor antes de fazer deploy
ALTER TABLE lojas ADD COLUMN IF NOT EXISTS cnpj TEXT;
