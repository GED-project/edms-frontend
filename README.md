# EDMS Frontend

Enterprise Document Management System — Frontend

## Tech Stack

- **Vite** + **React 19** + **TypeScript**
- **Tailwind CSS v4**
- **react-hook-form** + **Zod** — form validation
- **react-router-dom v7** — routing
- **lucide-react** — icons
- UI components sourced from [Metronic v9](https://keenthemes.com/metronic)

## Getting Started

```bash
npm install
npm run dev
```

## Project Structure

```
src/
├── auth/                   # Authentication module
│   ├── index.tsx           # Auth router
│   ├── lib/
│   │   └── register.schema.ts   # Zod validation schema
│   ├── pages/
│   │   └── register/       # Registration page
│   └── services/
│       └── auth.service.ts # API service layer (swap mock → real API)
├── components/
│   ├── screen-loader.tsx
│   └── ui/                 # Metronic UI primitives (button, input, checkbox…)
├── home/
│   └── page.tsx            # Home page
├── lib/
│   ├── utils.ts            # cn() helper
│   └── helpers.ts          # Misc helpers
├── providers/
│   └── app-router.tsx      # Route provider
└── styles/
    └── globals.css         # Tailwind + design tokens
```

## Routes

| Path | Component |
|---|---|
| `/` | Home page |
| `/auth/register` | Registration form |

## Backend Integration

The `src/auth/services/auth.service.ts` file contains mock implementations. Replace each function body with a real `fetch` / `axios` call to your API:

- `checkEmailAvailability(email)` → `GET /api/auth/check-email`
- `registerUser(payload)` → `POST /api/auth/register`

> **Note:** bcrypt hashing must be done server-side. The frontend sends credentials over HTTPS; the backend handles hashing and confirmation emails.
