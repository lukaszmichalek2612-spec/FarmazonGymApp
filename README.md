# FarmazonGymApp — TOP (vanilla + Firebase)

## Uruchomienie lokalnie
Najlepiej uruchomić jako serwer statyczny:
- VS Code → Live Server
albo
- `python -m http.server 5500` i wejść na `http://localhost:5500`

## GitHub (wrzut)
```bash
git init
git add .
git commit -m "FarmazonGymApp TOP"
git branch -M main
git remote add origin https://github.com/TWOJ_LOGIN/farmazon-gymapp.git
git push -u origin main
```

## Firebase Hosting (strona) + Firestore (dane)
1) Zainstaluj Firebase CLI:
```bash
npm i -g firebase-tools
firebase login
```

2) Zainicjuj hosting w folderze projektu:
```bash
firebase init hosting
# Use an existing project -> farmazongymapp
# public directory: .
# SPA: NO (mamy kilka html)
```

3) Deploy:
```bash
firebase deploy
```

## Firestore Rules (koniecznie!)
W Firebase Console → Firestore → Rules wklej:

```js
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;

      match /plans/{docId} {
        allow read, write: if request.auth != null && request.auth.uid == userId;
      }

      // notatki trenera (w tej wersji uproszczone)
      match /notes/{docId} {
        allow read: if request.auth != null && request.auth.uid == userId;
        allow write: if request.auth != null;
      }
    }
  }
}
```
