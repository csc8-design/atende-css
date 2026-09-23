
## Objetivo

Substituir o fluxo antigo da aba **Templates Meta** (seleção manual de contatos + template livre) por um fluxo **idêntico ao Disparo em Massa da Evolution** — upload de planilha, segmentação, throttle, cards premium — porém enviando via **API oficial da Meta** usando o template **arraiacbmaq**.

## Escopo

### 1. Banco — reutilizar `mass_campaigns` + `mass_campaign_leads`
Adicionar 2 colunas em `mass_campaigns`:
- `channel` text default `'evolution'` — valores: `evolution` | `meta_template`
- `meta_template_name` text nullable — ex: `arraiacbmaq`
- `meta_template_language` text default `'pt_BR'`

Não cria tabela nova — cards, KPIs, drawer de detalhes já existentes funcionam para ambos.

### 2. Novo componente `MetaTemplateCampaignsTab`
Cópia enxuta de `MassCampaignsTab` filtrando `channel = 'meta_template'`. Reusa `PremiumCampaignCard`, KPIs, drawer.

### 3. Novo modal `MetaTemplateCampaignCreateModal`
Cópia do `MassCampaignCreateModal` com:
- Remove seletor "Chip Evolution".
- Adiciona seletor **Template Meta** com preset `arraiacbmaq` (dropdown extensível — novos templates entram em uma constante).
- Mesmo upload de planilha (mesmas colunas: Nome, Empresa, Telefone, Modelo, Cidade…).
- Preview da mensagem do template (hardcoded para arraiacbmaq inicialmente) com variáveis substituídas pelo primeiro lead.
- Anexo de mídia opcional (header image do template, se aplicável).

### 4. Nova Edge Function `send-meta-mass-campaign`
Mesma estrutura do `send-mass-campaign` (loop, throttle, atualiza `mass_campaign_leads.status`), mas:
- Envia via Graph API `POST /{phone_number_id}/messages` com `type: template`.
- Preenche `template.components` com parâmetros do lead (nome, empresa, modelo).
- Trata erro Meta 130429 pausando a campanha (mesmo padrão do `send-campaign`).

### 5. `Campaigns.tsx`
Aba **Templates Meta** passa a renderizar `<MetaTemplateCampaignsTab />` no lugar da tabela + `CreateCampaignModal` antigo. Botão "Nova Campanha" some do header (fica dentro do tab, igual Evolution).

## Detalhes técnicos

- Template `arraiacbmaq`: preciso confirmar quantas variáveis `{{n}}` ele tem. Vou primeiro chamar `list-wa-templates` para descobrir o body e mapear variáveis (padrão sugerido: `{{1}}=nome`, `{{2}}=empresa`, `{{3}}=modelo`).
- Fluxo antigo (`campaigns` + `campaign_contacts` + `CreateCampaignModal` + `send-campaign`) permanece intocado no código mas fica fora da UI — não removo para não quebrar histórico.
- Throttle recomendado Meta: 1000-2000ms (dentro do rate limit da tier).

## O que **não** faço

- Não removo tabelas/funções antigas (`campaigns`, `send-campaign`).
- Não mexo no fluxo Evolution existente.
- Não altero webhook (respostas já são capturadas pela mesma função `check-mass-campaign-responses`).

## Confirmações que preciso

1. Posso listar seus templates Meta (chamando `list-wa-templates`) para pegar o corpo real do `arraiacbmaq` e mapear as variáveis corretamente?
2. Confirma que o mapa de variáveis será `{{1}}=Nome`, `{{2}}=Empresa`, `{{3}}=Modelo` — ou o template tem outra estrutura?
