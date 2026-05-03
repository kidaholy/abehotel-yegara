---
description: Full guide to set up Git Version Control and Node.js App in cPanel from scratch
---

# cPanel Full Setup: Git Version Control + Node.js App

Use this guide whenever you need to set up the project from scratch in cPanel.

---

## PART 1 — Set Up Git Version Control

### Step 1: Open Git™ Version Control
1. Log in to cPanel.
2. Under **Files**, click **Git™ Version Control**.
3. Click **Create** (blue button, top right).

### Step 2: Configure the Repository
Fill in the form:

| Field | Value |
|-------|-------|
| **Clone URL** | `https://github.com/kidaholy/abehotel-yegara.git` |
| **Repository Path** | e.g. `abehotel-yegara` (a new folder inside your home dir) |
| **Repository Name** | `abehotel-yegara` |

> **Note:** If GitHub asks for credentials, use a GitHub **Personal Access Token** as the password (not your regular password).

4. Click **Create** to clone the repo. Wait for it to finish.

---

## PART 2 — Set Up Node.js App

### Step 3: Open Setup Node.js App
1. In cPanel, under **Software**, click **Setup Node.js App**.
2. Click **Create Application**.

### Step 4: Configure the Application
Fill in the form:

| Field | Value |
|-------|-------|
| **Node.js version** | `18.x` or `20.x` (whichever is available) |
| **Application mode** | `Production` |
| **Application root** | The same path as your Git repo (e.g. `/home/yourusername/abehotel-yegara`) |
| **Application URL** | Your domain (e.g. `yourdomain.com` or a subdomain) |
| **Application startup file** | `server.js` |

> **Note:** The startup file is `server.js` — this is the compiled output. See Part 3 for how to build it.

5. Click **Create**.

---

## PART 3 — Install Dependencies & Build

### Step 5: Open the Terminal (SSH or cPanel Terminal)
Click the **Terminal** icon in cPanel, or use SSH.

Navigate to your app folder:
```bash
cd ~/abehotel-yegara
```

### Step 6: Install dependencies
```bash
npm install
```

### Step 7: Build the Next.js app
```bash
npm run build
```

### Step 8: Set environment variables
In the **Setup Node.js App** section, click **Edit** on your app. Scroll down to **Environment Variables** and add:

| Key | Value |
|-----|-------|
| `JWT_SECRET` | `your-secret-key-change-this-in-production` |
| `PORT` | `5000` |
| `FRONTEND_URL` | `https://yourdomain.com` |
| `NODE_ENV` | `production` |

---

## PART 4 — Start & Verify

### Step 9: Start the App
Back in **Setup Node.js App**, click **Run NPM Install** (if shown), then click **Start** or **Restart**.

### Step 10: Verify
Open your domain in a browser. The login page should appear.

---

## FUTURE DEPLOYMENTS

For future code updates, just use the `/cpanel-git-push` workflow — you won't need to redo this setup.
