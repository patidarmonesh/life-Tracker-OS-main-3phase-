# LifeOS

Personal life tracker built with React and Vite, deployed on Vercel.

## Daily planning and Google sync

Time Flow now supports diary photos, camera capture and typed plans, an editable tentative timeline, actual activity check-ins and plan adherence charts. Google Calendar reminders and automatic Drive token refresh use the Vercel backend.

**Deployment configuration:** [GOOGLE_SYNC_SETUP.md](GOOGLE_SYNC_SETUP.md). The backend needs server environment variables and a Google OAuth redirect URI before lasting Google sync will work. Configure your Gemini key in the existing app Settings for AI features.

```sh
npm ci
npm run dev
npm run build
npm test
npx playwright install chromium
npm run test:browser
```

The browser tests use isolated local sample data and mocked Google/Gemini responses. They do not modify a real account. New records stay in the existing Time Flow module and use the existing local/Drive persistence.

---

Original framework notes:

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and [`typescript-eslint`](https://typescript-eslint.io) in your project.
