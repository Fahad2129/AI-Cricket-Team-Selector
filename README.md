# 🏏 PSL AI CRICKET TEAM SELECTOR

> An AI-powered cricket team selector for the **Pakistan Super League (PSL)** — built with 5 machine learning algorithms implemented from scratch in pure Python. No ML libraries. No black boxes.

![Python](https://img.shields.io/badge/Python-3.11+-blue) ![React](https://img.shields.io/badge/React-TypeScript-61DAFB) ![FastAPI](https://img.shields.io/badge/FastAPI-Backend-009688) ![License](https://img.shields.io/badge/License-MIT-green)

---

## 📌 What It Does

Given a **PSL venue**, the system recommends an optimal **11-player squad** of Pakistani cricketers by passing player statistics through a sequential pipeline of 5 AI algorithms. Every selected player comes with a human-readable justification based on their stats.

**Supported Venues:** Karachi · Lahore · Multan · Rawalpindi

---

## 🤖 The AI Pipeline

All 5 algorithms are implemented **from scratch in pure Python** — no scikit-learn, no TensorFlow, no external ML libraries.

| # | Algorithm | Role in Pipeline |
|---|-----------|-----------------|
| 1 | **Linear Regression** | Computes impact score per player via gradient descent |
| 2 | **K-Means Clustering** | Groups players into archetypes (Aggressive Hitter, Powerplay Bowler, etc.) |
| 3 | **Naive Bayes** | Estimates venue-specific performance probability |
| 4 | **CART Decision Tree** | Classifies players into performance tiers (Great / Good / Average / Poor) |
| 5 | **Genetic Algorithm** | Assembles the optimal role-balanced 11-player squad |

**Final Score Formula:**
```
Final Score = 0.45 × Impact Score + 0.25 × Bayesian Score + 0.30 × Venue Score
```

---

## 🖥️ Tech Stack

| Layer | Technology |
|-------|------------|
| Data | Pandas, OpenPyXL |
| AI/ML | Pure Python 3.11+ |
| Backend | FastAPI, Uvicorn |
| Frontend | React, TypeScript, Tailwind CSS |
| Charts | Recharts |
| Build | Vite 7, pnpm, uv |

---

## ✨ Features

- **Team Selector** — Pick a venue and get an AI-optimised 11-player squad
- **Player Explorer** — Browse and filter all players by role, venue, and stats
- **AI Form Predictions** — Next-match performance forecast for every player
- **Leaderboard** — Top 5 performers per role, filterable by venue
- **Statistics Dashboard** — Interactive charts, scatter plots, and sortable tables
- **Player Detail View** — Deep-dive into any player's AI score breakdown and career stats

---

## ⚙️ How to Run

### Prerequisites

Install these three tools before starting:

- **Python 3.11+** → https://www.python.org/downloads/ ⚠️ Check **"Add Python to PATH"** during install
- **Node.js (LTS)** → https://nodejs.org/
- **pnpm** → After installing Node.js, run:
```powershell
npm install -g pnpm
```

---

### Step 1 — Clone the Repo

```powershell
git clone https://github.com/Fahad2129/AI-Cricket-Team-Selector.git
cd AI-Cricket-Team-Selector
```

### Step 2 — Install Python Packages

```powershell
python -m pip install uv
python -m uv sync
```

### Step 3 — Install Node Packages

```powershell
pnpm install --ignore-scripts
pnpm add @esbuild/win32-x64@0.27.3 -w --ignore-scripts
pnpm add @tailwindcss/oxide-win32-x64-msvc -w --ignore-scripts
```

### Step 4 — Run the App

You need **two PowerShell windows** open at the same time.

**Terminal 1 — Start the Backend:**
```powershell
.venv\Scripts\python.exe artifacts\api-server\main.py
```
You should see:
```
Uvicorn running on http://0.0.0.0:8080
```

**Terminal 2 — Start the Frontend:**
```powershell
cd artifacts\psl-ai
$env:PORT="5173"
$env:BASE_PATH="/"
$env:NODE_ENV="development"
pnpm run dev
```
You should see:
```
VITE v7.3.2 ready
➜ Local: http://localhost:5173/
```

### Step 5 — Open in Browser

```
http://localhost:5173
```

> To stop the app, press **Ctrl + C** in both terminals.

---

## ❌ Common Issues

| Problem | Fix |
|---------|-----|
| `python` not recognized | Reinstall Python and check **"Add Python to PATH"** |
| `pnpm` not recognized | Run `npm install -g pnpm` then reopen PowerShell |
| Port 8080 already in use | API is already running — just open the frontend |
| No players showing | Make sure Terminal 1 (backend) is running |
| `No pyvenv.cfg` error | Run `python -m uv sync` again |

---

## 📂 Project Structure

```
AI-Cricket-Team-Selector/
├── artifacts/
│   ├── api-server/        ← Python backend + all 5 AI algorithms
│   └── psl-ai/            ← React/TypeScript frontend
├── attached_assets/       ← PSL Excel data files
├── lib/                   ← Shared utilities
├── pyproject.toml         ← Python dependencies
├── pnpm-lock.yaml         ← Node dependencies
└── README.md
```

---

## 👥 Team

| Name | ID |
|------|----|
| Emad Yar Khan | 31651 |
| Fahad Azfar | 31659 |
| Fahad Faisal | 31583 |
| Muhammad Saad Godil | 31616 |

---

## 📚 References

- Lemmer, H.H. — *Batting Performance Indices*, 2004
- Saikia, Bhattacharjee & Lemmer — *Predicting Bowler Performance*, 2016
- Ahmed, Deb & Jindal — *Multi-objective Cricket Squad Selection*, 2013
- Manage & Scariano — *Principal Components on Cricket Ground Data*, 2013
- Kampakis & Thomas — *Predicting Cricket Match Outcomes*, 2015
