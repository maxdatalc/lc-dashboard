"""
Um comando so: pega o .mkv gravado pelo OBS (2 trilhas de audio: Desktop
Audio = a pessoa do outro lado da chamada, Mic = voce) e ja entrega o
dialogo transcrito e rotulado, pronto pra colar no chat.

Uso basico:
    python reunioes/processar_reuniao.py reunioes/audio/2026-07-08.mkv

Por padrao assume (verificado com uma gravacao real de teste em 2026-07-05):
    trilha 0 do arquivo (1a trilha de audio) = "Voce"   (Mic)
    trilha 1 do arquivo (2a trilha de audio) = "Gestor" (Desktop Audio)

Se no seu OBS a ordem ficou trocada, rode de novo so com --inverter (nao
precisa refazer a gravacao nem separar nada manualmente).

Nao precisa de ffmpeg instalado — a leitura das trilhas e feita com PyAV,
que ja vem junto do faster-whisper.

Depois de transcrever com sucesso, o arquivo de video/audio original e
apagado automaticamente (ele costuma ser bem maior que o texto gerado e
ja nao serve pra nada depois de transcrito). So fica se a transcricao sair
vazia, pra dar chance de tentar de novo.
"""

import argparse
import sys
import time
from pathlib import Path

import numpy as np


def extrair_trilha(caminho, indice_stream, sample_rate=16000):
    import av

    container = av.open(str(caminho))
    audio_streams = list(container.streams.audio)
    if indice_stream >= len(audio_streams):
        container.close()
        return None

    stream = audio_streams[indice_stream]
    resampler = av.AudioResampler(format="s16", layout="mono", rate=sample_rate)
    pedacos = []
    for frame in container.decode(stream):
        for resampled in resampler.resample(frame):
            arr = resampled.to_ndarray()
            if arr.size:
                pedacos.append(arr.reshape(-1))
    container.close()

    if not pedacos:
        return np.zeros(0, dtype=np.float32)
    pcm = np.concatenate(pedacos)
    return pcm.astype(np.float32) / 32768.0


def transcrever_array(model, audio, idioma):
    if audio is None or audio.size == 0:
        return []
    segments, _ = model.transcribe(audio, language=idioma, vad_filter=True)
    resultado = []
    for seg in segments:
        texto = seg.text.strip()
        if texto:
            resultado.append((seg.start, seg.end, texto))
    return resultado


def main():
    parser = argparse.ArgumentParser(description="Transcreve e mescla uma gravacao de 2 trilhas num so comando")
    parser.add_argument("arquivo", help="Arquivo .mkv (ou outro container) com as trilhas de audio da ligacao")
    parser.add_argument("--modelo", default="small", choices=["tiny", "base", "small", "medium", "large-v3"])
    parser.add_argument("--idioma", default="pt")
    parser.add_argument("--nome-trilha0", default="Voce", help="Rotulo da 1a trilha de audio (padrao: Mic = Voce)")
    parser.add_argument("--nome-trilha1", default="Gestor", help="Rotulo da 2a trilha de audio (padrao: Desktop Audio = Gestor)")
    parser.add_argument("--inverter", action="store_true", help="Troca os rotulos padrao das duas trilhas")
    parser.add_argument("--saida", default=None, help="Caminho do arquivo de saida (padrao: reunioes/transcricoes/<nome>-dialogo.txt)")
    args = parser.parse_args()

    caminho = Path(args.arquivo)
    if not caminho.exists():
        print(f"Arquivo nao encontrado: {caminho}", file=sys.stderr)
        sys.exit(1)

    nome0, nome1 = args.nome_trilha0, args.nome_trilha1
    if args.inverter:
        nome0, nome1 = nome1, nome0

    try:
        from faster_whisper import WhisperModel
    except ImportError:
        print(
            "faster-whisper nao instalado. Rode: python -m pip install -r reunioes/requirements.txt",
            file=sys.stderr,
        )
        sys.exit(1)

    print(f"Lendo trilhas de audio de {caminho.name}...")
    audio0 = extrair_trilha(caminho, 0)
    audio1 = extrair_trilha(caminho, 1)

    if audio0 is None:
        print("Nao encontrei nenhuma trilha de audio no arquivo.", file=sys.stderr)
        sys.exit(1)

    modo_dialogo = audio1 is not None
    if not modo_dialogo:
        print("Encontrei so 1 trilha de audio no arquivo — vou transcrever sem separar falantes.")
        print("(pra separar por pessoa, grave com 2 trilhas no OBS — ver README)")

    print(f"Carregando modelo '{args.modelo}' (CPU, int8)... primeira vez pode baixar os pesos.")
    model = WhisperModel(args.modelo, device="cpu", compute_type="int8")

    t0 = time.time()

    print(f"Transcrevendo trilha 0 ({nome0 if modo_dialogo else 'unica trilha'})...")
    trechos0 = [(s, e, nome0, t) for s, e, t in transcrever_array(model, audio0, args.idioma)]
    if trechos0:
        print(f"  primeira fala: \"{trechos0[0][3][:80]}\"")

    trechos1 = []
    if modo_dialogo:
        print(f"Transcrevendo trilha 1 ({nome1})...")
        trechos1 = [(s, e, nome1, t) for s, e, t in transcrever_array(model, audio1, args.idioma)]
        if trechos1:
            print(f"  primeira fala: \"{trechos1[0][3][:80]}\"")
        print("(se os rotulos saíram trocados, rode de novo com --inverter)")

    todos = sorted(trechos0 + trechos1, key=lambda x: x[0])

    linhas = []
    for inicio, _fim, falante, texto in todos:
        mm, ss = divmod(int(inicio), 60)
        prefixo = f"{falante}: " if modo_dialogo else ""
        linhas.append(f"[{mm:02d}:{ss:02d}] {prefixo}{texto}")

    out_dir = Path(__file__).resolve().parent / "transcricoes"
    out_dir.mkdir(parents=True, exist_ok=True)
    caminho_saida = Path(args.saida) if args.saida else out_dir / f"{caminho.stem}-dialogo.txt"
    caminho_saida.parent.mkdir(parents=True, exist_ok=True)
    caminho_saida.write_text("\n".join(linhas), encoding="utf-8")

    print(f"\nConcluido em {time.time() - t0:.0f}s.")
    print(f"Resultado: {caminho_saida}")

    if not linhas:
        print(
            "\nA transcricao saiu vazia — mantendo o arquivo original para voce poder "
            "conferir/tentar de novo (ex.: --inverter, outro --modelo)."
        )
    else:
        tamanho_mb = caminho.stat().st_size / (1024 * 1024)
        try:
            caminho.unlink()
            print(f"\nArquivo original apagado para poupar espaco: {caminho} ({tamanho_mb:.1f} MB liberados)")
        except OSError as e:
            print(f"\nNao consegui apagar o arquivo original ({caminho}): {e}", file=sys.stderr)


if __name__ == "__main__":
    main()
