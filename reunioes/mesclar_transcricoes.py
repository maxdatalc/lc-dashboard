"""
Mescla duas transcricoes (uma por pessoa, cada uma gerada por transcrever.py
a partir de uma trilha de audio separada) num unico dialogo, ordenado por
tempo e com o nome do falante em cada linha.

Isso resolve "quem esta falando" sem precisar de diarizacao por IA: como
cada arquivo de audio ja veio de uma trilha isolada (seu microfone vs.
audio do sistema/chamada), a separacao de falante e garantida pela
gravacao, nao por adivinhacao de um modelo.

Uso:
    python reunioes/mesclar_transcricoes.py \
        reunioes/transcricoes/2026-07-08-mic.timestamps.txt "Voce" \
        reunioes/transcricoes/2026-07-08-sistema.timestamps.txt "Gestor" \
        --saida reunioes/transcricoes/2026-07-08-dialogo.txt

Espera o formato gerado por transcrever.py em *.timestamps.txt:
    [MM:SS - MM:SS] texto do trecho
"""

import argparse
import re
from pathlib import Path

LINHA_RE = re.compile(r"^\[(\d{2}):(\d{2}) - (\d{2}):(\d{2})\]\s*(.*)$")


def carregar_trechos(caminho: Path, falante: str):
    trechos = []
    for linha in caminho.read_text(encoding="utf-8").splitlines():
        m = LINHA_RE.match(linha.strip())
        if not m:
            continue
        mm_i, ss_i, mm_f, ss_f, texto = m.groups()
        if not texto.strip():
            continue
        inicio = int(mm_i) * 60 + int(ss_i)
        trechos.append((inicio, mm_i, ss_i, falante, texto.strip()))
    return trechos


def main():
    parser = argparse.ArgumentParser(description="Mescla duas transcricoes por timestamp, com rotulo de falante")
    parser.add_argument("arquivo1", type=Path)
    parser.add_argument("falante1")
    parser.add_argument("arquivo2", type=Path)
    parser.add_argument("falante2")
    parser.add_argument("--saida", type=Path, default=None)
    args = parser.parse_args()

    trechos = carregar_trechos(args.arquivo1, args.falante1) + carregar_trechos(args.arquivo2, args.falante2)
    trechos.sort(key=lambda t: t[0])

    linhas = [f"[{mm}:{ss}] {falante}: {texto}" for (_, mm, ss, falante, texto) in trechos]

    saida = args.saida or args.arquivo1.parent / f"{args.arquivo1.stem.replace('.timestamps', '')}-dialogo.txt"
    saida.write_text("\n".join(linhas), encoding="utf-8")

    print(f"Dialogo mesclado ({len(linhas)} falas): {saida}")
    print("\nAtencao: a ordem e por horario de inicio de cada trecho. Se as duas pessoas")
    print("falarem ao mesmo tempo (interrupcao), a ordem entre as duas linhas pode nao")
    print("refletir exatamente quem comecou a falar primeiro — isso e normal e raramente")
    print("atrapalha o entendimento geral da conversa.")


if __name__ == "__main__":
    main()
