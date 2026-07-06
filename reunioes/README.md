# Transcrever ligação

Cole o `.mkv` gravado pelo OBS em `reunioes/audio/` e rode:

```bash
python reunioes/processar_reuniao.py reunioes/audio/NOME-DO-ARQUIVO.mkv
```

Resultado em `reunioes/transcricoes/NOME-DO-ARQUIVO-dialogo.txt`. O `.mkv` é apagado automaticamente ao final.

Se os rótulos "Você"/"Gestor" saírem trocados:

```bash
python reunioes/processar_reuniao.py reunioes/audio/NOME-DO-ARQUIVO.mkv --inverter
```

Depois, cole o conteúdo do `-dialogo.txt` aqui no chat para eu extrair decisões e ações.
