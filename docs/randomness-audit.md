# Auditoria de aleatoriedade

## Resultado

Não foi encontrado favorecimento no algoritmo nem no percurso da interface. O motor de produção não foi alterado: usa Fisher–Yates com `crypto.getRandomValues` e rejeição dos valores que introduziriam viés no módulo. Não lê nomes, reputação, histórico, velocidade ou preferências para atribuir pesos.

Foram executados **660 000 sorteios** em 18 cenários com Web Crypto nativo, sem sementes fixas nem geradores simulados: Liga Portugal (120 000), Liga Portugal com ordem de entrada invertida (120 000), cada um dos outros 14 países (24 000 por país), todos os 108 clubes (54 000) e uma shortlist de cinco clubes (30 000). Foram contadas as vitórias e todas as posições de eliminação.

Os resultados são compatíveis com probabilidades iguais. Uma simulação finita não prova a ausência de qualquer viés; complementa a revisão do algoritmo e a enumeração exaustiva nos testes. O limiar diagnóstico de 7 desvios-padrão é deliberadamente amplo para muitas comparações e não é uma certificação estatística.

## Liga Portugal: 120 000 sorteios

12 clubes elegíveis: probabilidade teórica **1/12 = 8,333…% por clube**. Esperança: 10 000 vitórias por clube. As contagens não devem ser forçadas a ser iguais.

| Clube         | Vitórias observadas | Percentagem |
| ------------- | ------------------: | ----------: |
| Sporting CP   |               10140 |     8.4500% |
| FC Porto      |               10075 |     8.3958% |
| SL Benfica    |               10023 |     8.3525% |
| SC Braga      |                9951 |     8.2925% |
| Vitória SC    |               10046 |     8.3717% |
| Boavista      |                9998 |     8.3317% |
| Rio Ave       |                9980 |     8.3167% |
| FC Famalicão  |                9962 |     8.3017% |
| Moreirense    |                9990 |     8.3250% |
| Gil Vicente   |                9948 |     8.2900% |
| Estoril Praia |                9968 |     8.3067% |
| Santa Clara   |                9919 |     8.2658% |

Ao inverter a ordem de entrada, o Sporting ganhou 9 909 de 120 000 sorteios (8,2575%). Ser o primeiro clube da lista não lhe dá vantagem.

## Repetições

Cada sorteio é independente. Com os mesmos 12 clubes elegíveis, depois de uma vitória do Sporting, a probabilidade de ele ganhar o sorteio seguinte continua a ser 1/12. A probabilidade de dois sorteios previamente escolhidos serem ambos Sporting é 1/144. A probabilidade de qualquer vencedor se repetir no sorteio seguinte é 1/12.

Na primeira simulação portuguesa ocorreram 10 013 pares consecutivos com o mesmo vencedor, num total de 119 999 pares. O valor esperado é aproximadamente 10 000. Não se devem bloquear repetições, alternar vencedores nem compensar vitórias anteriores: isso tornaria os sorteios dependentes.

## Verificação da interface

Foram concluídas **120 cerimónias reais no Chromium**, com 12 clubes portugueses, Web Crypto nativo e velocidades 1×, 2× e 4×. Foi registado cada número devolvido por `crypto.getRandomValues` sem o substituir. Uma reconstrução independente da permutação confirmou, em todas as cerimónias, a ordem de cada eliminação e o vencedor apresentado.

Foram observadas 120 ordens distintas; todos os 12 clubes ganharam pelo menos uma vez. O Sporting ganhou 9 vezes. Esta amostra pequena serve para validar a integração, não para estimar precisamente as probabilidades. O teste foi executado neste ambiente Linux/Chromium; não inspeciona o estado guardado no navegador Windows do utilizador.

## Testes de regressão

- Enumeração das 720 sequências de escolhas equiprováveis para seis clubes: 720 permutações distintas; cada clube ocupa cada posição exatamente 120 vezes.
- Novos pedidos de entropia em cada sorteio; repetições legítimas permitidas.
- Rejeição da cauda dos inteiros de 32 bits antes de calcular o índice, também no baralhamento.
- Nenhuma mutação do pote original; cada clube ocorre exatamente uma vez.

## Reproduzir

```sh
npm test
npm run audit:randomness
# Opcional: guardar o resultado de uma nova execução
npm run audit:randomness -- novo-relatorio.json
```

As contagens mudam em cada execução porque a aleatoriedade é real. O comando usa o algoritmo de produção, não um sorteio alternativo. O relatório completo desta execução, incluindo todos os cenários e os resultados da integração no navegador, está em [randomness-audit.json](randomness-audit.json).

As probabilidades referem-se aos clubes efetivamente elegíveis depois de filtros, shortlist e exclusões. Não há um sorteio prévio de país ou liga: uma liga com mais clubes elegíveis tem maior probabilidade agregada, mas cada clube continua a ter 1/N. A lista de demonstração não confirma a disponibilidade no FM27.
