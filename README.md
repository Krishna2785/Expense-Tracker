# Smart Expense Tracker

A full-stack personal finance application that automates expense tracking via Indian bank and UPI SMS parsing.
Built for individuals seeking real-time budget tracking, spending insights, and intelligent merchant auto-categorization.

## Features
- **Authentication**: Secure JWT authentication with per-user multi-tenant data isolation.
- **Expense Management**: Full CRUD operations with category, month, and year filters, plus date/amount sorting.
- **SMS Parser**: Parses transaction alerts across 4 major Indian banks (HDFC, SBI, ICICI, Axis) and UPI without saving drafts.
- **Auto-Categorizer**: Maps 80+ merchant keywords across 7 categories with user-defined override rules that take priority.
- **Monthly Budgets**: Category spending limits with real-time visual progress bars and color-coded threshold warnings.
- **Dashboard Charts**: Visual analytics powered by Recharts, including category donut charts and annual monthly totals.
- **Rule-Based Insights**: Pure algorithm detection for unusual spending (>2x average), recurring monthly bills, and month-end pace.
- **Responsive UI**: Mobile-friendly interface featuring an adaptive navigation bar with user profile badge and secure logout.

## Tech Stack
- **Frontend**: React 18, Vite, React Router 6, Recharts, Axios, Vanilla CSS
- **Backend**: Node.js, Express.js
- **Database**: MongoDB, Mongoose
- **Auth**: JSON Web Tokens (JWT), bcryptjs
- **Testing**: Jest (48 automated unit and controller tests across 4 suites)

## Folder Structure
```text
Expense Tracker/
├── client/
│   ├── public/
│   └── src/
│       ├── components/
│       ├── context/
│       ├── pages/
│       └── services/
└── server/
    ├── controllers/
    ├── middleware/
    ├── models/
    ├── routes/
    ├── tests/
    └── utils/
```

## Setup Instructions

### 1. Backend Setup
1. `cd server`
2. `npm install`
3. Copy `.env.example` to `.env` and set environment variables
4. `npm run dev` (starts server on http://localhost:5000)

### 2. Frontend Setup
1. `cd client`
2. `npm install`
3. `npm run dev` (starts client on http://localhost:5173)

### 3. Running Tests
Run all 48 Jest tests from the server directory:
```bash
cd server && npm test
```

## Environment Variables

| Variable | Purpose |
| :--- | :--- |
| `PORT` | Port number for the Express server |
| `MONGO_URI` | MongoDB connection string |
| `JWT_SECRET` | Secret key for JWT signing and verification |
| `NODE_ENV` | Runtime environment (`development` / `production`) |

## API Endpoints

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `POST` | `/api/auth/register` | Register a new user |
| `POST` | `/api/auth/login` | Authenticate user and receive JWT |
| `GET` | `/api/auth/profile` | Get authenticated user profile |
| `GET` | `/api/expenses` | Get expenses with filtering and sorting |
| `POST` | `/api/expenses` | Create a new expense or income record |
| `GET` | `/api/expenses/summary` | Get aggregated monthly spending summary |
| `POST` | `/api/expenses/parse-sms` | Parse raw SMS text without saving |
| `POST` | `/api/expenses/merchant-rule` | Create or update merchant category override |
| `GET` | `/api/expenses/:id` | Get single expense details |
| `PUT` | `/api/expenses/:id` | Update an existing expense |
| `DELETE` | `/api/expenses/:id` | Delete an expense |
| `GET` | `/api/budgets` | Get category budgets with progress |
| `POST` | `/api/budgets` | Create a category budget limit |
| `GET` | `/api/budgets/:id` | Get single budget details |
| `PUT` | `/api/budgets/:id` | Update budget limit |
| `DELETE` | `/api/budgets/:id` | Delete category budget |
| `GET` | `/api/insights` | Get unusual spending, recurring bills, and forecast |
