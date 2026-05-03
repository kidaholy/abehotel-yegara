---
description: Full guide to set up Git Version Control and Node.js App in cPanel from scratch
---

# cPanel Full Setup: Git Version Control + Node.js App

This is the **proven working setup** for Yegara cPanel using the GitHub `deploy` branch + Phusion Passenger.

---

## HOW IT WORKS

```
Local Code  →  git push main  →  GitHub Actions builds it  →  pushes to deploy branch  →  cPanel pulls deploy branch
```

- You push to `main` as normal.
- GitHub Actions automatically builds the app and puts the compiled output in the `deploy` branch.
- cPanel **only** pulls the `deploy` branch — no building needed on the server.
- Startup file is `app.js` (Passenger entry point).

---

## PART 1 — Set Up Git Version Control in cPanel

1. Log in to cPanel → Open **Git™ Version Control**
2. Click **Create**
3. Fill in:

| Field | Value |
|-------|-------|
| **Clone URL** | `https://github.com/kidaholy/abehotel-yegara.git` |
| **Repository Path** | `abehotel-deploy` ← **do NOT use public_html directly** |
| **Repository Name** | `AbeHotel` |

4. Click **Create** and wait for clone to finish.
5. Click **Manage** on the repo → Go to **Pull or Deploy** tab
6. **Change the branch** from `main` to `deploy`
7. Click **Update from Remote** — this pulls the pre-built files.

---

## PART 2 — Set Up Node.js App in cPanel

1. Go to **Setup Node.js App** → Click **Create Application**
2. Fill in:

| Field | Value |
|-------|-------|
| **Node.js version** | `20.x` |
| **Application mode** | `Production` |
| **Application root** | `abehotel-deploy` ← same as Git repo path |
| **Application URL** | Your domain (e.g. `yegara.com`) |
| **Application startup file** | `app.js` |

3. Add **Environment Variables**:

| Key | Value |
|-----|-------|
| `JWT_SECRET` | `your-secret-key-change-this-in-production` |
| `PORT` | `3000` |
| `FRONTEND_URL` | `https://yourdomain.com` |
| `NODE_ENV` | `production` |

4. Click **Run NPM Install** → then click **Start** (or Restart).

---

## FUTURE DEPLOYMENTS

For all future code updates, just use `/cpanel-git-push`:

1. `git add -A`
2. `git commit -m "your message"`
3. `git push origin main`
4. Wait ~2 mins for GitHub Actions to finish building.
5. In cPanel → Git Version Control → Manage → Pull or Deploy → **Update from Remote**
6. In cPanel → Setup Node.js App → **Restart**
