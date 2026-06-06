# freemoney

freemoney is a personal finance, expense tracking, and savings optimization app.
It focuses on removing manual data entry by reading bank or credit card
statements and by simulating a WhatsApp bot for everyday expense capture.

## Features

- Light, dark, and system theme support with OLED-friendly dark colors.
- Bottom navigation for Main, Income, Spending, and Savings.
- English and Spanish statement parsing from PDF, TXT, pasted text, or CSV-like
  lines.
- Intermediate approval stage before imported transactions are added.
- Income tracking with manual entries and recurrence settings.
- Spending history, manual expense entry, and natural-language WhatsApp-style
  messages such as `1500 coffee` or `Software subscription 15 usd`.
- Savings goals, round-up automation, Pay Yourself First retention rules, and
  historical savings charts.
- Multi-currency wallet support for ARS, USD, and USDC with live exchange-rate
  refresh and local fallback rates.

## Local development

```bash
npm install
npm run dev
```

Open the localhost URL printed by Vite for the full app experience. If you open
`index.html` directly from the desktop with Chrome, freemoney shows a static
desktop fallback instead of a blank page because browsers cannot run the Vite
TypeScript source app from `file://`.

## Production build

```bash
npm run build
```
