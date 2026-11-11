# Vita Stay — Frontend

React 18 operator portal (Vite + MUI + Redux Toolkit). This is **not** Next.js.

The app is a **PG / hostel ERP**. Public search, booking, and the full photo/360 gallery are specified in `docs/` and are not in this UI yet.

## Prerequisites

- Node.js ≥ 18
- Backend API running (default `http://localhost:5000`)

## Setup

```bash
cp .env.example .env
npm install
npm run dev
```

`.env`:

```
VITE_API_URL=http://localhost:5000/api
```

Dev server: **http://localhost:3001**  
Vite proxies `/api` and `/uploads` to port 5000 (`vite.config.js`).

Optional one-command stack (MySQL + API + this UI behind nginx): from the repo root run `docker compose up --build` and open **http://localhost:8080**. Native Windows Node + MySQL does not need Docker. See `vitastay_new_back/README.md`.

## Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Vite dev server |
| `npm run build` | Production bundle → `dist/` |
| `npm run preview` | Serve `dist` |
| `npm run lint` | ESLint |

## Main routes

Auth: `/auth/login`, `/auth/forgot-password`, `/auth/reset-password`  
Role dashboards under `/dashboard/*`  
ERP: hostels, rooms, tenants, rent, revenue, expenses, visitors, complaints, maintenance, notices, staff, attendance, inventory, reports, settings, notifications, profile  
Super Admin: `/super-admin/register-hostel`, `/super-admin/users`

Unauthenticated users are sent to login. `/` redirects to the role dashboard.

## Stack

- React 18, React Router 7, Redux Toolkit
- MUI 6, Emotion, Chart.js, Axios, react-hook-form, dayjs, notistack

## Media gallery (planned)

Owners and Super Admin/tech will manage **Outside / Inside / Room / Floor / 360°** photos on `/hostels/:id/media`. Seekers will see all of those images on the public listing page. See `docs/05-ux-ui-design.md`.

## Troubleshooting

| Issue | Check |
| --- | --- |
| Login fails / CORS | API up, `VITE_API_URL`, backend `CORS_ORIGINS` includes `http://localhost:3000` |
| Images 404 | API serving `/uploads`; `getMediaUrl` uses API origin |
| Blank page after login | Role route access in `src/utils/constants.js` |
| Stale API URL in prod | `VITE_*` is compile-time — rebuild after changing env |
