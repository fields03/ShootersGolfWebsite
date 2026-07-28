# Shooters Golf — Website

Public marketing and help site for **Shooters Golf**, hosted on **GitHub Pages**.

Pages:

- `index.html` — Home
- `features.html` — Features & game formats
- `help.html` — Help / FAQ
- `privacy.html` — Privacy policy

Admin data tools stay in the HandiMan app repo (`web-admin`) and run on your machine only — they are not part of this site.

## Preview locally

From this folder:

```bash
npx --yes serve .
```

Or:

```bash
python3 -m http.server 8080
```

Then open `http://localhost:3000` (serve) or `http://localhost:8080`.

## Publish on GitHub Pages

### 1. Create a GitHub repository

1. Sign in at [github.com](https://github.com)
2. Click **New repository**
3. Name it e.g. `HandiMan_Website` (or `ShootersGolf`)
4. Leave it **empty** (no README / .gitignore / license)
5. Create the repository

### 2. Push this folder

In Terminal, from this folder:

```bash
cd "/Users/mac508/Documents/Software Applications/HandiMan_Website"
git init
git add .
git commit -m "Add Shooters Golf public website"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/HandiMan_Website.git
git push -u origin main
```

Replace `YOUR_USERNAME` and the repo name with yours.

### 3. Turn on Pages

1. On GitHub, open the repo → **Settings** → **Pages**
2. Under **Build and deployment** → **Source**, choose **Deploy from a branch**
3. Branch: **main**, folder: **/ (root)**
4. Save

After a minute or two, the site will be at:

`https://YOUR_USERNAME.github.io/HandiMan_Website/`

(If the repo is named `YOUR_USERNAME.github.io`, the site is at `https://YOUR_USERNAME.github.io/`.)

### 4. Optional next steps

- Add your real support email on the Privacy and Help pages
- Add App Store / Play Store links on the home page when ready
- Point a custom domain (e.g. `shootersgolf.com`) under Pages → Custom domain

## Note on paths

Links use relative paths (`features.html`, `assets/...`), so the site works both at the repo root on Pages and when previewed locally.
