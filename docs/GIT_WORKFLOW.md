# Git Branching Workflow — Cenein

This document describes the Git branching strategy used in this project, the step-by-step workflow every developer must follow, and how to handle common real-world situations.

---

## Table of Contents

1. [Branch Structure](#branch-structure)
2. [Branch Rules](#branch-rules)
3. [Developer Workflow — Starting a New Feature](#developer-workflow--starting-a-new-feature)
4. [Developer Workflow — Daily Work (Resuming the Next Day)](#developer-workflow--daily-work-resuming-the-next-day)
5. [Developer Workflow — Finishing a Feature](#developer-workflow--finishing-a-feature)
6. [Promoting Code: Development → Staging → Main](#promoting-code-development--staging--main)
7. [Common Scenarios & Troubleshooting](#common-scenarios--troubleshooting)
8. [Quick Reference Cheat Sheet](#quick-reference-cheat-sheet)

---

## Branch Structure

The project uses **three permanent branches** and temporary **feature branches**:

```
main          ← Production code (stable, deployed)
 └── staging  ← Testing & QA (pre-production validation)
      └── development  ← Active development (integration branch)
           ├── feature/login-page
           ├── feature/patient-search
           └── feature/...
```

| Branch           | Purpose                                                                | Who merges into it                               | Deploys to               |
| ------------------| ------------------------------------------------------------------------| --------------------------------------------------| --------------------------|
| `main`           | Stable production code. Only tested and approved code lives here.      | Team lead / after QA approval                    | Production               |
| `staging`        | Pre-production testing. Code is validated here before going to `main`. | Team lead / designated reviewer                  | Staging / QA environment |
| `development`    | Integration branch. All completed features are merged here.            | Any developer (via Pull Request or direct merge) | Development environment  |
| `feature/<name>` | Temporary branch for a single feature or task. Deleted after merging.  | Developer working on the feature                 | Local only               |

---

## Branch Rules

> **⚠️ IMPORTANT — Never commit directly to `main` or `staging`.**

1. **`main`** is read-only for developers. Only receives merges from `staging` after QA approval.
2. **`staging`** only receives merges from `development`. No direct commits.
3. **`development`** only receives merges from feature branches. Avoid committing directly to it.
4. **Feature branches** are always created from `development` and merged back into `development`.
5. Every feature branch must have a descriptive name: `feature/patient-export`, `feature/fix-login-bug`, etc.

---

## Developer Workflow — Starting a New Feature

Follow these steps **every time** you begin working on a new feature.

### Step 1 — Make sure your local repository is up to date

Before creating any branch, you need to download the latest changes from the remote repository.

```bash
# Switch to the development branch
git checkout development

# Download ALL changes from the remote (all branches)
git fetch origin

# Merge the latest remote development into your local development
git pull origin development
```

> **Why `fetch` + `pull`?**
> - `git fetch origin` downloads the latest state of all remote branches without modifying your local files. It updates your knowledge of what's on the server.
> - `git pull origin development` actually applies those changes to your current branch. It's equivalent to `git fetch` + `git merge`.
> - Running `fetch` first is a good habit because it lets you inspect what changed before applying it.

### Step 2 — Create a new feature branch

```bash
# Create and switch to a new branch based on development
git checkout -b feature/my-new-feature
```

This creates a new branch called `feature/my-new-feature` that starts from the current state of `development` and immediately switches you to it.

> **Naming convention:** Use `feature/` prefix followed by a short, descriptive, lowercase name with hyphens. Examples:
> - `feature/patient-search`
> - `feature/attendance-report`
> - `feature/fix-login-redirect`

### Step 3 — Work and commit

Now you're on your feature branch. Write your code, and commit frequently with clear messages.

```bash
# Check which files have been modified
git status

# Stage specific files
git add path/to/file1.py path/to/file2.html

# Or stage ALL modified files
git add .

# Commit with a descriptive message
git commit -m "Add patient search endpoint with filters"
```

> **Commit message tips:**
> - Use imperative mood: "Add feature" not "Added feature"
> - Be specific: "Fix null pointer in patient export" not "Fix bug"
> - Keep the first line under 72 characters

### Step 4 — Push your feature branch to the remote

Push your branch so it exists on GitHub (as a backup, and so others can see your progress):

```bash
# First push — sets up tracking
git push -u origin feature/my-new-feature

# Subsequent pushes (after the first one)
git push
```

---

## Developer Workflow — Daily Work (Resuming the Next Day)

You started a feature yesterday but didn't finish. Today you come back and other developers may have merged their work into `development`. Here's what you need to do:

### Step 1 — Fetch the latest changes

```bash
# Download the latest state of all remote branches
git fetch origin
```

### Step 2 — Update your local development branch

```bash
# Switch to development
git checkout development

# Pull the latest changes
git pull origin development
```

### Step 3 — Go back to your feature branch and bring in the new changes

```bash
# Switch back to your feature branch
git checkout feature/my-new-feature

# Merge the updated development into your feature branch
git merge development
```

> **Why merge `development` into your feature branch?**
> This keeps your feature branch up to date with what everyone else has been doing. If you skip this step, you risk having big, painful merge conflicts when you try to merge your feature back into `development` later.

### Step 4 — Resolve conflicts (if any)

If Git reports merge conflicts, it means two people modified the same lines in the same file. Git will mark the conflicting areas in the file like this:

```
<<<<<<< HEAD
// Your code (from your feature branch)
const timeout = 5000;
=======
// Their code (from development)
const timeout = 3000;
>>>>>>> development
```

To resolve:

1. Open each conflicted file and decide which version to keep (or combine both).
2. Remove the conflict markers (`<<<<<<<`, `=======`, `>>>>>>>`).
3. Stage the resolved files and commit:

```bash
git add path/to/resolved-file.js
git commit -m "Resolve merge conflict with development"
```

### Step 5 — Continue working

Now you're up to date. Continue coding, committing, and pushing as normal.

```bash
# ... make changes ...
git add .
git commit -m "Continue implementing patient search filters"
git push
```

---

## Developer Workflow — Finishing a Feature

Your feature is complete and ready to be integrated.

### Step 1 — Final update from development

Before merging, make sure you have the absolute latest version of `development`:

```bash
git checkout development
git pull origin development

git checkout feature/my-new-feature
git merge development
```

Resolve any conflicts if they appear (see the conflict resolution steps above).

### Step 2 — Push your final changes

```bash
git push
```

### Step 3 — Merge into development

**Via GitHub Pull Request**

1. Go to the repository on GitHub.
2. Click **"Compare & pull request"** for your feature branch.
3. Set the base branch to `development`.
4. Add a description of what the feature does.
5. Request a code review from a teammate (if applicable).
6. Once approved, click **"Merge pull request"**.


### Step 4 — Clean up the feature branch

After the merge is complete, delete the feature branch (it's no longer needed):

```bash
# Delete locally
git branch -d feature/my-new-feature

# Delete on the remote
git push origin --delete feature/my-new-feature
```

---

## Promoting Code: Development → Staging → Main

After several features have been merged into `development` and the team decides it's time to test and release:

### Development → Staging

```bash
git checkout staging
git pull origin staging
git merge development
git push origin staging
```

At this point, tests run on the `staging` environment. The team verifies everything works correctly.

### Staging → Main (After QA Approval)

Only after all tests pass and the team confirms the code is ready:

```bash
git checkout main
git pull origin main
git merge staging
git push origin main
```

> **🚨 This step should only be performed by the team lead or a designated person.** Merging into `main` means deploying to production.

---

## Common Scenarios & Troubleshooting

### 📌 "I accidentally committed to `development` instead of my feature branch"

If you haven't pushed yet:

```bash
# Undo the last commit but keep your changes
git reset --soft HEAD~1

# Now create/switch to your feature branch
git checkout -b feature/my-feature

# Re-commit there
git add .
git commit -m "My feature changes"
```

### 📌 "I forgot to pull before starting my feature branch"

Your feature branch is based on an old version of `development`. No problem — just update it:

```bash
git checkout development
git pull origin development

git checkout feature/my-feature
git merge development
# Resolve conflicts if any
```

### 📌 "I want to see what changed on the remote before pulling"

```bash
git fetch origin
git log HEAD..origin/development --oneline
```

This shows you all the commits that exist on the remote `development` but not on your current branch.

### 📌 "Two developers are working on the same feature"

Both developers should work on the same feature branch. Coordinate by pushing and pulling frequently:

```bash
# Developer B pulls the latest from the shared feature branch
git checkout feature/shared-feature
git pull origin feature/shared-feature

# ... make changes ...
git add .
git commit -m "My contribution"
git push
```


---

## Quick Reference Cheat Sheet

| Task | Command |
|---|---|
| Switch branch | `git checkout <branch>` |
| Create and switch to new branch | `git checkout -b feature/<name>` |
| Download remote changes (no merge) | `git fetch origin` |
| Download and apply remote changes | `git pull origin <branch>` |
| Stage files | `git add <files>` or `git add .` |
| Commit | `git commit -m "message"` |
| Push (first time) | `git push -u origin feature/<name>` |
| Push (subsequent) | `git push` |
| Merge branch into current branch | `git merge <branch>` |
| Delete local branch | `git branch -d <branch>` |
| Delete remote branch | `git push origin --delete <branch>` |
| Stash changes | `git stash` / `git stash pop` |
| View commit history | `git log --oneline --graph` |
| Check current branch and status | `git status` |

---

## Summary — The Full Lifecycle

```
1.  git checkout development
2.  git fetch origin
3.  git pull origin development
4.  git checkout -b feature/my-feature
5.  ... work, commit, push ...
6.  (next day) git fetch → git checkout development → git pull → git checkout feature/my-feature → git merge development
7.  ... continue working, commit, push ...
8.  (done) Final merge development into feature, then merge feature into development
9.  Delete feature branch
10. (release cycle) development → staging → main
```
