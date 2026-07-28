# Shooters Golf — Website

Public marketing and help site for **Shooters Golf**, hosted on **GitHub Pages**.

**Live site:** https://fields03.github.io/ShootersGolfWebsite/

Pages:

- `index.html` — Home
- `features.html` — Features & game formats
- `help.html` — Help / FAQ
- `privacy.html` — Privacy policy
- `admin.html` — Firestore admin (email + password; **only** `fields.zachary@gmail.com`)

The local Admin SDK tool in `HandiMan_Main/web-admin` still works on your machine. The hosted admin uses Firebase Auth + Firestore rules instead (no service account on the web).

## Admin setup (required once)

### 1. Confirm email/password auth is enabled

1. Open [Firebase Console](https://console.firebase.google.com) → project **handiman-1b845**
2. **Build → Authentication → Sign-in method**
3. Make sure **Email/Password** is enabled
4. Under **Authentication → Users**, confirm `fields.zachary@gmail.com` exists (same password you use in the app). If it doesn’t, add that user there.

### 2. Allow your GitHub Pages domain

1. Firebase → **Authentication → Settings → Authorized domains**
2. Add: `fields03.github.io`
3. Keep `localhost` for local testing

### 3. Deploy updated Firestore rules

The rules file in `HandiMan_Main/firestore.rules` grants full Firestore access only when signed in as **fields.zachary@gmail.com**.

Deploy from the HandiMan_Main folder (after installing Firebase CLI if needed):

```bash
cd "/Users/mac508/Documents/Software Applications/HandiMan_Main"
npx --yes firebase-tools login
npx --yes firebase-tools deploy --only firestore:rules
```

Or paste/publish the updated rules in Firebase Console → **Firestore → Rules**.

Without this step, admin login may succeed but listing/editing data will fail with permission errors.

### 4. Open admin

https://fields03.github.io/ShootersGolfWebsite/admin.html

Sign in with **fields.zachary@gmail.com** and that account’s password. Any other email is rejected.

## Preview locally

```bash
cd "/Users/mac508/Documents/Software Applications/HandiMan_Website"
npx --yes serve .
```

Then open `/admin.html` as well (still needs authorized domain `localhost` and deployed rules).

## Publish updates

```bash
cd "/Users/mac508/Documents/Software Applications/HandiMan_Website"
git add .
git commit -m "Add password-protected admin console"
git push
```

Pages usually updates within a minute or two.
