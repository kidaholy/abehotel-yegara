---
description: How to push code changes to cPanel via GitHub Git Version
---

# Push to cPanel via Git

This workflow pushes all local changes to GitHub, then pulls them in cPanel using the Git Version Manager.

// turbo-all

## Step 1: Stage all changes

```bash
cmd /c git add -A
```

## Step 2: Commit with a message

```bash
cmd /c git commit -m "update: push changes to production"
```

## Step 3: Push to GitHub

```bash
cmd /c git push origin main
```

## Step 4: Pull in cPanel

1. Log in to your cPanel account.
2. Navigate to **Git™ Version Control**.
3. Find the repository for this project.
4. Click **Manage** → **Pull or Deploy** tab.
5. Click the **Update from Remote** button.
6. Wait for the pull to complete successfully.
7. If there is a **Deploy** button in the Deploy section, click it next.

## Step 5: Restart the Node.js App (if needed)

1. In cPanel, go to **Setup Node.js App**.
2. Find the app for this project.
3. Click **Restart** to reload the app with the new files.
