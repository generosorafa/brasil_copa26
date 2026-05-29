# Brasil Copa 2026

Site estático para acompanhar a Seleção Brasileira na Copa do Mundo FIFA 2026.

## Estrutura

- `index.html`: entrada principal do site.
- `brasil.html`: redirecionamento para preservar links antigos.
- `data/site-data.js`: fonte única para jogos, grupo, elenco e estádios.
- `js/app.js`: renderização dinâmica, calendário, ICS, abas, bracket e interações.
- `css/styles.css`: sistema visual responsivo.
- `scripts/validate-data.js`: valida consistência dos dados antes de publicar.

## Atualizar durante a Copa

1. Edite apenas `data/site-data.js`.
2. Para placares, mude `status` para `"final"` e preencha `score`.
3. Para jogos futuros confirmados, mantenha `status` como `"scheduled"`.
4. Para cenários de mata-mata ainda dependentes da classificação, use `"conditional"`.
5. Rode `npm run validate` antes de publicar.

## Rodar localmente

```bash
npm run validate
npm run dev
```

Depois abra `http://localhost:4173`.
