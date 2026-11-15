# TACTICAL OPS — publicação do servidor multiplayer no Railway

## O que há neste pacote
- `server.js`: servidor HTTP + WebSocket (Node.js 20+).
- `index.html`: cliente TACTICAL OPS V17. O cliente abre automaticamente a conexão WSS usando o mesmo domínio onde o jogo está hospedado.
- `package.json`: dependência `ws` e comando `npm start`.

## Publicar pelo painel (mais simples)
1. Extraia este ZIP no computador.
2. Crie um repositório GitHub novo, por exemplo `tactical-ops-railway`.
3. Envie os quatro arquivos (`index.html`, `server.js`, `package.json`, `README-RAILWAY.md`) para a raiz do repositório.
4. Acesse https://railway.com/new e entre com sua conta.
5. Escolha **Deploy from GitHub Repo** e autorize o GitHub, se solicitado.
6. Selecione `tactical-ops-railway` e inicie o deploy.
7. Em **Settings → Networking**, use **Generate Domain** para criar o domínio público `*.up.railway.app`.
8. Aguarde o deploy ficar ativo.

## Verificar
- Abra `https://SEU-DOMINIO.up.railway.app/health`.
- Resposta esperada: JSON contendo `"status":"online"`.
- Abra `https://SEU-DOMINIO.up.railway.app/` para carregar o jogo.
- O jogo usa o mesmo host e conecta via `wss://SEU-DOMINIO.up.railway.app` automaticamente. Não precisa editar o HTML nem adicionar query string.
- Abra o jogo em dois celulares/navegadores diferentes. O indicador do servidor deve mudar para ONLINE e os jogadores conectados devem aparecer na cena.

## Configuração do serviço
- Runtime: Node.js (detectado pelo `package.json`).
- Build: `npm install` (automático).
- Start command: `npm start`.
- Porta: usa `process.env.PORT` fornecida pelo Railway; o servidor escuta em `0.0.0.0`.
- Health check: `/health` (opcional configurar em Settings/Deploy se o painel mostrar esse campo).
- Variáveis manuais: nenhuma obrigatória. Não defina PORT manualmente.

## Importante — limites atuais do protótipo
- Sala única `dock-4x4`, máximo de 8 conexões por instância.
- O jogo envia posição a 20 Hz; o servidor retransmite snapshots a 20 Hz.
- Eventos de tiro/dano/respawn e placar têm validação básica. Movimento ainda é informado pelo cliente e o cálculo de acerto é uma aproximação 2D; não é anti-cheat de produção.
- Estado das partidas fica na memória. Reiniciar/reimplantar o serviço limpa a sala.
- Use uma única réplica/instância nesta etapa. Para escalar horizontalmente será necessário Redis/pub-sub e sessões coordenadas.
- O HTML carrega Three.js e o modelo GLB externo pela internet; o dispositivo precisa de acesso a esses recursos.

## Diagnóstico
- `Application failed to respond`: confira os logs; o servidor precisa iniciar com `npm start` e ouvir `process.env.PORT` em `0.0.0.0`.
- `/health` não responde: verifique se o deploy está `Online` e se o domínio foi gerado.
- Jogo abre, mas mostra servidor desconectado: confira o domínio HTTPS, os logs do serviço e se o navegador está permitindo WebSocket seguro.
- Não teste dois jogadores na mesma aba: use dois dispositivos ou duas sessões de navegador.
