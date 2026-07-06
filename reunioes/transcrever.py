"""
Transcreve uma gravacao de ligacao (audio ou video) para texto, 100% local,
usando faster-whisper (CPU, sem GPU, sem custo, sem enviar dados para fora
da maquina).

Uso:
    python reunioes/transcrever.py <arquivo_de_audio_ou_video> [opcoes]

Exemplos:
    python reunioes/transcrever.py reunioes/audio/2026-07-08-gestor.mp4
    python reunioes/transcrever.py reunioes/audio/call.m4a --modelo medium

Saida:
    reunioes/transcricoes/<nome-do-arquivo>.txt        (texto corrido, para colar no chat)
    reunioes/transcricoes/<nome-do-arquivo>.timestamps.txt  (com marcacao de tempo por trecho)

Primeira execucao com um modelo novo baixa os pesos do Hugging Face
(uma vez so, fica em cache local). Depois disso funciona offline.
"""

import argparse
import sys
import time
from pathlib import Path


def main():
    parser = argparse.ArgumentParser(description="Transcricao local de ligacoes (faster-whisper)")
    parser.add_argument("arquivo", help="Caminho do arquivo de audio/video da ligacao")
    parser.add_argument(
        "--modelo",
        default="small",
        choices=["tiny", "base", "small", "medium", "large-v3"],
        help="Tamanho do modelo Whisper. 'small' = bom equilibrio em CPU. "
             "'medium'/'large-v3' = mais precisos, porem mais lentos sem GPU. (padrao: small)",
    )
    parser.add_argument("--idioma", default="pt", help="Codigo do idioma (padrao: pt)")
    parser.add_argument(
        "--saida",
        default=None,
        help="Pasta de saida (padrao: reunioes/transcricoes/, ao lado deste script)",
    )
    args = parser.parse_args()

    audio_path = Path(args.arquivo)
    if not audio_path.exists():
        print(f"Arquivo nao encontrado: {audio_path}", file=sys.stderr)
        sys.exit(1)

    try:
        from faster_whisper import WhisperModel
    except ImportError:
        print(
            "faster-whisper nao instalado. Rode: python -m pip install -r reunioes/requirements.txt",
            file=sys.stderr,
        )
        sys.exit(1)

    out_dir = Path(args.saida) if args.saida else Path(__file__).resolve().parent / "transcricoes"
    out_dir.mkdir(parents=True, exist_ok=True)

    print(f"Carregando modelo '{args.modelo}' (CPU, int8)... primeira vez pode baixar os pesos.")
    model = WhisperModel(args.modelo, device="cpu", compute_type="int8")

    print(f"Transcrevendo: {audio_path.name}")
    t0 = time.time()
    segments, info = model.transcribe(
        str(audio_path),
        language=args.idioma,
        vad_filter=True,  # pula silencio, melhora velocidade e reduz alucinacao
    )

    plain_lines = []
    timestamped_lines = []
    for seg in segments:
        text = seg.text.strip()
        if not text:
            continue
        plain_lines.append(text)
        mm_s, ss_s = divmod(int(seg.start), 60)
        mm_e, ss_e = divmod(int(seg.end), 60)
        timestamped_lines.append(f"[{mm_s:02d}:{ss_s:02d} - {mm_e:02d}:{ss_e:02d}] {text}")
        print(f"  {mm_s:02d}:{ss_s:02d} {text}")

    base_name = audio_path.stem
    plain_path = out_dir / f"{base_name}.txt"
    ts_path = out_dir / f"{base_name}.timestamps.txt"
    plain_path.write_text("\n".join(plain_lines), encoding="utf-8")
    ts_path.write_text("\n".join(timestamped_lines), encoding="utf-8")

    elapsed = time.time() - t0
    print(f"\nConcluido em {elapsed:.0f}s. Duracao do audio detectada: {info.duration:.0f}s.")
    print(f"Transcricao (texto corrido): {plain_path}")
    print(f"Transcricao (com timestamps): {ts_path}")


if __name__ == "__main__":
    main()
