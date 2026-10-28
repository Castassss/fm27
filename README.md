# The Draw

Aplicação em português para escolher o próximo clube de Football Manager numa cerimónia de eliminações. Interface em três etapas, cinco temas, favoritos, seleções com nome, desafios opcionais e coleção pessoal. Os dados ficam no navegador.

## Executar

Node.js 22 ou superior. A aplicação não tem dependências npm para instalar.

```sh
npm run dev
```

Abrir `http://localhost:3000` no computador onde o comando está a correr. Manter o terminal aberto. A porta pode ser alterada com `PORT`. No Windows PowerShell:

```powershell
$env:PORT=3001
npm run dev
```

Para atualizar uma cópia Git: parar com Ctrl+C, executar `git pull origin main`, voltar a executar `npm run dev` e atualizar o navegador com Ctrl+F5. O servidor usa `fileURLToPath` para suportar caminhos Windows e diretórios com espaços.

## O percurso

1. **O teu desafio**: mundo inteiro, favoritos, coleção europeia ou outros continentes representados na demonstração. Selecionar uma promessa opcional: promover três jogadores formados no clube até à terceira época, ficar três épocas, ou não contratar na primeira janela. Estas regras são compromissos do jogador; não pressupõem dados de finanças ou qualidade das academias.
2. **Os teus clubes**: múltiplos países e ligas por caixas de seleção, clubes clicáveis, favoritos por coração, ações em lote sobre os resultados da pesquisa e seleções guardadas com nome. Sem países/ligas marcados, todos os países/ligas do ponto de partida entram. Pesquisar não muda o pote; incluir/retirar resultados muda explicitamente os participantes. O resumo mostra a probabilidade por clube.
3. **O grande momento**: cerimónia automática ou totalmente manual, contagem decrescente, eliminações individuais, momento dos quatro finalistas (opcional), duelo final e vencedor. Pausar, retomar, avançar, escolher entre três ritmos, entrar em modo cinema ou cancelar sem guardar resultado. No modo manual, cada clique avança um momento; os quatro finalistas e a final são momentos próprios.

Durante a cerimónia, o coração ao lado de um participante permite torcer por ele. É apenas um palpite visual e **não modifica a ordem nem as probabilidades**. As listas de sobreviventes e eliminados são pesquisáveis.

Depois do sorteio: aceitar o destino na coleção, descarregar um cartão SVG autónomo, copiar o resultado ou excluir o vencedor e repetir. Na coleção é possível dar um nome ao save, recuperar seleções, consultar fichas e retirar entradas. O histórico suporta até 100 sorteios; a coleção suporta 100 saves e 20 seleções. Apagar histórico não apaga saves aceites.

A aparência tem cinco temas persistentes: Lavanda, Campo, Rosa, Oceano e Noite. As opções incluem volume, som sintetizado no navegador, voz opcional (depende das vozes disponíveis no sistema), menos movimento e momentos de suspense. A preferência de movimento reduzido do sistema também é respeitada. Não existem fontes, músicas ou imagens carregadas de serviços externos.

## Dados e limites atuais

A base incluída tem **108 clubes de demonstração em 15 países**. É uma lista parcial, não uma base oficial de FM27. A disponibilidade dos clubes e a composição das ligas na versão do jogo não foram confirmadas. Não se deve apresentar esta coleção como inventário completo dos clubes jogáveis. Os emblemas são monogramas gráficos, sem uso de logótipos oficiais.

Os percursos geográficos usam listas explícitas de países representados nesta demonstração. Países desconhecidos numa importação não são classificados por adivinhação: ficam disponíveis no percurso mundial e nos filtros.

Em **A minha coleção → A tua base de clubes**, importar um array JSON com `name`, `country` e `league` (strings obrigatórias, até 150 caracteres). Há um exemplo descarregável na interface. Limites: 50 000 clubes, ficheiro de 15 MB e quota disponível no navegador. A importação requer confirmação e substitui a base, limpa favoritos/filtros/seleções guardadas, preservando histórico e saves aceites. É possível restaurar a demonstração com confirmação.

```json
[
  { "name": "FC Porto", "country": "Portugal", "league": "Liga Portugal" },
  { "name": "SL Benfica", "country": "Portugal", "league": "Liga Portugal" }
]
```

**Acesso comercial:** esta versão é uma aplicação local. Não implementa contas, pagamentos, convites, sincronização entre dispositivos ou controlo de acesso privado. Um lançamento reservado a membros requer backend com autenticação, autorização e armazenamento seguro no servidor. Não colocar credenciais em JavaScript/localStorage nem usar a coleção local como proteção de acesso. Nenhum selo visual constitui autenticação.

Para completar a base FM27, obter uma fonte autorizada e confirmar edição/versão, ligas jogáveis versus apenas visíveis e clubes por divisão. O projeto não tem afiliação à Sports Interactive.

## Validação e aleatoriedade

```sh
npm run check
npm test
npm run audit:randomness
```

O sorteio conserva o motor auditado: Fisher–Yates com `crypto.getRandomValues` e rejeição dos valores que introduziriam viés. Cada clube elegível tem probabilidade 1/N de sobreviver. Nomes, reputação, tema, desafios, palpites, som, ritmo e histórico não entram no algoritmo. Cada sorteio é independente e pode repetir vencedores. Não se equilibram artificialmente contagens.

A auditoria documentada executou 660 000 sorteios e verificou também o percurso da interface da versão anterior. O motor de aleatoriedade foi preservado nesta versão. Ver [relatório completo](docs/randomness-audit.md). `npm run audit:randomness -- novo-relatorio.json` grava uma nova execução; as contagens variam naturalmente.

Os testes cobrem justiça combinatória, rejeição de índices enviesados, preservação dos participantes, filtros, restauração exata das seleções, fronteiras dos percursos geográficos e funcionamento HTTP. A experiência de três etapas também foi validada no Chromium em computador e telemóvel, incluindo importação, temas, favoritos, final, coleção, persistência, renomeação e download SVG. Isto não substitui testes nos navegadores e dispositivos de um lançamento comercial.

### Teste funcional no navegador (opcional)

O teste abaixo é independente de `npm test`. Instala Playwright apenas para desenvolvimento, sem alterar os manifestos ou criar um lockfile:

```sh
npm install --no-save --package-lock=false playwright
npx playwright install chromium
npm run test:browser
```

O runner inicia e termina o seu próprio servidor na porta 31579 e escreve capturas numa pasta temporária, cujo caminho apresenta no fim. Testa o percurso completo, a persistência, a importação, a coleção, o cartão SVG e o telemóvel. Compara também o vencedor com uma reconstrução da ordem a partir da entropia nativa, depois de interagir com o palpite de apoio a um clube.

Em ambientes com Chromium e Playwright já instalados, `DRAW_BROWSER_PATH` e `DRAW_PLAYWRIGHT_MODULE` permitem indicar esses executáveis/módulos. `DRAW_NO_SANDBOX=1` só deve ser usado quando o ambiente de testes isolado o exigir; não é necessário num Windows normal.
