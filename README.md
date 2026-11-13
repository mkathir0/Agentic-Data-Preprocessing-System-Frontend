# Agentic Data Preprocessing System — Frontend

A modern, production-grade Next.js & React dashboard for the **Agentic Data Preprocessing System**. Built to visualize the 5-stage LangGraph preprocessing loop, lazy Pandera contract validation, 4-dimensional data quality scores, and Great Expectations suite exports in real-time.

---

## 🌟 Key Features

- **Executive 4-Dimensional Data Quality Scorecard**:
  - Baseline vs. Cleaned Quality Score tracking (e.g. `82.6 → 98.4`, `+15.8%`).
  - Four dedicated mathematical dimensions:
    - **Completeness**: Null reduction and conservative imputation auditing.
    - **Validity**: Pandera lazy schema contracts and domain boundary rules.
    - **Uniqueness**: Multi-column exact deduplication and primary key conflict isolation.
    - **Consistency**: Temporal precedence (`end_time >= start_time`) and arithmetic invariants (`qty * price = total`).
- **Pandera Lazy Contract Verification**:
  - Real-time schema verification status (`PASSED` vs `CIRCUIT BREAKER SELF-HEALED`).
  - Detailed breakdown of failure cases and constraint violations fed back into the self-healing loop.
- **Data Integrity & Key Conflict Detection**:
  - Exact duplicates dropped.
  - Near-duplicate clustering via fuzzy matching (Levenshtein token set ratio $\ge 85\%$).
  - Primary key collisions (identical IDs with differing record data) escalated to human review.
- **Great Expectations (GX) Interoperability Suite**:
  - Automatic Pandera-to-GX schema translation.
  - Live inspection, 1-click JSON copying, and direct suite download for CI/CD or dbt data pipelines.
- **5-Stage Pipeline Visualizer**:
  - Live animated visual state for the LangGraph stages: `Profile` → `Plan` → `Code` → `Execute` → `Validate`.
- **Interactive Cleaned CSV Preview**:
  - High-performance, Excel-style spreadsheet preview supporting virtualized scroll and direct CSV download.

---

## 🛠️ Tech Stack

- **Framework**: Next.js 16 (App Router, Turbopack)
- **UI Library**: React 19, Tailwind CSS 4, Lucide React
- **Animations**: Framer Motion
- **API Client**: REST with `X-API-Key` authentication

---

## 🚀 Getting Started

### 1. Prerequisites
- Node.js `v20+` or `v25+`
- The backend FastAPI service running on `http://localhost:8000` (from the [Backend Repository](https://github.com/mkathir0/Agentic-Data-Preprocessing-System.))

### 2. Installation
```bash
git clone https://github.com/mkathir0/Agentic-Data-Preprocessing-System-Frontend.git
cd Agentic-Data-Preprocessing-System-Frontend
npm install
```

### 3. Environment Configuration
Copy `.env.example` to `.env.local`:
```bash
cp .env.example .env.local
```

Ensure `.env.local` points to your backend instance:
```env
NEXT_PUBLIC_API_URL=http://localhost:8000/api
NEXT_PUBLIC_API_KEY=default_secret_key
```

### 4. Run the Development Server
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 🔗 Architecture & Separation of Concerns

| Service | Directory / Repo | Port | Description |
|---|---|---|---|
| **Backend** | `Agentic-Data-Preprocessing-System.` | `8000` | FastAPI, LangGraph 5-stage loop, Pandera validation engine, SQLite/PostgreSQL |
| **Frontend** | `Agentic-Data-Preprocessing-System-Frontend` | `3000` | Next.js 16, interactive pipeline visualizer, 4D scorecard, GX suite exporter |

---

## 📦 Production Build

```bash
npm run build
npm run start
```
