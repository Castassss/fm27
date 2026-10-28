# The Draw

Aplicação de sorteios de clubes para escolher um novo save de Football Manager. Interface em português, cerimónia animada com som opcional, filtros cumulativos, shortlist, exclusões, histórico e importação JSON. Preferências e histórico ficam no navegador, sem conta ou servidor de dados.

## Desenvolvimento

Requer Node.js 22 ou superior. Sem dependências npm para instalar.

```sh
npm run dev
npm run check
npm test
```

O servidor escuta na porta 3000 (configurável por `PORT`). Abrir a aplicação num navegador. O sorteio usa `crypto.getRandomValues` com rejeição para evitar viés e sorteia uniformemente entre os clubes elegíveis. O modo de movimento reduzido encurta a cerimónia. O áudio é sintetizado localmente e opcional.

## Dados

A base incluída é uma **demonstração parcial**, não uma base oficial de FM27. Os clubes são exemplos reais; a composição das ligas e a disponibilidade no jogo não estão confirmadas. Não foi possível consultar a fonte oficial por bloqueio de rede durante a criação. Não existe nesta versão qualquer alegação de cobertura mundial completa.

Em Explorar clubes é possível importar um array JSON com `name`, `country` e `league` (strings obrigatórias, até 150 caracteres cada). A importação substitui a base local, limpa a shortlist/exclusões e permanece no navegador. Até 50 000 clubes, ficheiro até 15 MB; sujeito à quota de armazenamento do navegador. Não introduz código executável. Dados importados continuam assinalados como não verificados. Exemplo:

```json
[{"name":"FC Porto","country":"Portugal","league":"Liga Portugal"}]
```

Para uma base completa: obter uma fonte autorizada, confirmar a edição e versão do jogo, distinguir ligas jogáveis de ligas apenas visíveis e validar clubes por divisão. Não usar esta demonstração como inventário de equipas jogáveis. Não são usados emblemas oficiais; os escudos são monogramas gráficos.

Sem afiliação à Sports Interactive. Fontes Google são opcionais; existem fontes locais de fallback.
