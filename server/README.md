# Vehicle Calculation System — API Server

Node.js + Express + TypeScript + MongoDB (Mongoose) REST API.

## Run locally

```bash
cd server
npm install
cp .env.example .env      # then paste your MongoDB connection string
npm run dev               # http://localhost:4000/api/health
```

## Deploy (Render / Railway / any Node host)

- Root directory: `server`
- Build command: `npm install && npm run build`
- Start command: `npm start`
- Environment variables: `MONGODB_URI`, `PORT`, `CORS_ORIGIN`, `SUPABASE_URL`, and `SUPABASE_PUBLISHABLE_KEY`

Set `CORS_ORIGIN` to your frontend origin (or `*` while testing).

## Connect the frontend

In the app open **Settings → Backend connection** and paste the API base URL, e.g.
`https://your-api.onrender.com/api`. It is also readable from the `VITE_API_URL`
build variable.

## Endpoints

| Method | Path |
| --- | --- |
| GET | `/api/health` |
| GET/POST | `/api/vehicles` |
| GET/PUT/DELETE | `/api/vehicles/:id` |
| GET | `/api/vehicles/:vehicleId/trips` |
| GET/POST | `/api/trips` (query: `vehicleId`, `fromDate`, `toDate`, `page`, `limit`) |
| GET/PUT/DELETE | `/api/trips/:id` |
| GET | `/api/reports?vehicleId=&fromDate=&toDate=` |
| GET/PUT | `/api/settings` |

Deleting a vehicle also deletes its trips. Derived amounts (`otherExpenses`,
`totalExpense`, `profit`) are always recomputed on the server.
