# Video Chat App — Deployment Guide

## Architecture
- **Frontend** → Vercel (React + Vite)
- **Backend**  → Railway (Express + Socket.io)

---

## Step 1 — Push to GitHub

```bash
cd "C:/Users/Harsh/OneDrive/Desktop/vc"
git init
git add .
git commit -m "Initial commit — Video Chat App"
```

Then create a new repo at https://github.com/new and push:
```bash
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO.git
git branch -M main
git push -u origin main
```

---

## Step 2 — Deploy Backend to Railway

1. Go to https://railway.app and sign in with GitHub
2. Click **New Project → Deploy from GitHub Repo**
3. Select your repo
4. Click **Add Service → GitHub Repo** again, pick the repo
5. In the service settings, set the **Root Directory** to `server`
6. Railway will auto-detect Node.js and run `npm start`
7. Click **Generate Domain** (free subdomain like `your-app.up.railway.app`)
8. Copy that URL — you'll need it next

---

## Step 3 — Deploy Frontend to Vercel

1. Go to https://vercel.com and sign in with GitHub
2. Click **Add New → Project**
3. Import your GitHub repo
4. Leave **Root Directory** as `/` (the Vite frontend)
5. In **Environment Variables**, add:
   ```
   VITE_SERVER_URL = https://YOUR_RAILWAY_URL.up.railway.app
   ```
6. Click **Deploy**

---

## Step 4 — Set CORS on Railway (for security)

In your Railway service dashboard → Variables, add:
```
ALLOWED_ORIGIN = https://YOUR_VERCEL_APP.vercel.app
PORT = 3001
```

---

## Local Development

```bash
# Terminal 1 — Server
cd server
npm run dev

# Terminal 2 — Frontend
cd C:/Users/Harsh/OneDrive/Desktop/vc
npm run dev
```

Frontend: http://localhost:5173
Server:   http://localhost:3001
