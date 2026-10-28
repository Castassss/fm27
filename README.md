# The Draw

Aplicação de sorteios de clubes para escolher um novo save de Football Manager. Interface futurista em português, cerimónia por eliminações sucessivas com som opcional, filtros cumulativos, shortlist, exclusões, histórico e importação JSON. Preferências e histórico ficam no navegador, sem conta ou servidor de dados.

## Desenvolvimento

Requer Node.js 22 ou superior. Sem dependências npm para instalar.

```sh
npm run dev
npm run check
npm test
```

O servidor escuta na porta 3000 (configurável por `PORT`). Abrir a aplicação num navegador. A ordem das eliminações usa Fisher–Yates com `crypto.getRandomValues` e rejeição para evitar viés; todos os clubes têm a mesma probabilidade de ser o último sobrevivente. São necessários pelo menos dois clubes. O modo de movimento reduzido desativa as animações, preservando a sequência e o ritmo escolhido. O áudio é sintetizado localmente e opcional.

## A experiência de eliminação

1. Escolher país e ligas (caixas de seleção, sem Ctrl). Sem ligas selecionadas, participam todas as ligas do país escolhido.
2. Usar o universo completo ou a shortlist. A estrela adiciona/remove da shortlist; o botão − exclui do pote e + reinclui. Repor limpa filtros e exclusões, preservando a shortlist.
3. Pesquisar clubes sem alterar os participantes. O contador e o painel Em jogo mostram sempre o pote efetivo.
4. Iniciar: cada clube eliminado é revelado individualmente, sai da lista Em jogo e fica no registo Eliminados. Os últimos dois têm um confronto final antes da última eliminação.
5. Pausar/retomar, avançar uma etapa com Próxima, escolher ritmo Cinemático, Rápido ou Turbo, ou cancelar sem guardar um vencedor. Durante a pausa, Próxima avança uma etapa sem retomar o automático. A mudança de ritmo preserva a etapa atual.
6. O sobrevivente é guardado no histórico. É possível copiar o resultado ou excluí-lo e iniciar outra cerimónia. O histórico preserva resultados antigos da versão clássica, identificados como tal.

O botão no canto superior direito expande o palco. No telemóvel, a configuração recolhe durante o sorteio e os controlos ficam fixos no fundo. A lista de participantes e o registo de eliminados são pesquisáveis; listas extensas têm paginação incremental. Não são guardados resultados de cerimónias canceladas ou interrompidas por um recarregamento.

## Dados

A base incluída é uma **demonstração parcial**, não uma base oficial de FM27. Os clubes são exemplos reais; a composição das ligas e a disponibilidade no jogo não estão confirmadas. Não foi possível consultar a fonte oficial por bloqueio de rede durante a criação. Não existe nesta versão qualquer alegação de cobertura mundial completa.

Em Explorar clubes é possível importar um array JSON com `name`, `country` e `league` (strings obrigatórias, até 150 caracteres cada). A importação substitui a base local, limpa a shortlist/exclusões e permanece no navegador. Até 50 000 clubes, ficheiro até 15 MB; sujeito à quota de armazenamento do navegador. Não introduz código executável. Dados importados continuam assinalados como não verificados. Exemplo:

```json
[{ "name": "FC Porto", "country": "Portugal", "league": "Liga Portugal" }]
```

Para uma base completa: obter uma fonte autorizada, confirmar a edição e versão do jogo, distinguir ligas jogáveis de ligas apenas visíveis e validar clubes por divisão. Não usar esta demonstração como inventário de equipas jogáveis. Não são usados emblemas oficiais; os escudos são monogramas gráficos.

Sem afiliação à Sports Interactive. Fontes Google são opcionais; existem fontes locais de fallback.
