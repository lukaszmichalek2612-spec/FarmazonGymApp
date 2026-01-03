# FarmazonGymApp — PRO v3 (jak topowe apki)
## Co jest w v3
- Plan (autosave)
- Dziennik (zapis treningu do Firestore)
- Progres (wykres e1RM w canvas)
- Biblioteka ćwiczeń (wyszukiwarka + ulubione)
- Trener: klienci + kopiowanie planu + notatki + podgląd ostatnich treningów

## Hosting i GitHub
- Repo: pliki w ROOT, branch main
- Firebase Hosting: public directory = . , SPA = NO

## Firestore Rules (dla v3)
Wklej do Firestore → Rules:

```js
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    function signedIn() { return request.auth != null; }
    function roleOf(uid) { return get(/databases/$(database)/documents/users/$(uid)).data.role; }
    function isTrainer() { return signedIn() && roleOf(request.auth.uid) == "trainer"; }
    function isOwner(userId) { return signedIn() && request.auth.uid == userId; }
    function isClient(userId) { return get(/databases/$(database)/documents/users/$(userId)).data.role == "user"; }
    function trainerCanAccess(userId) { return isTrainer() && isClient(userId); }
    function canAccessUser(userId) { return isOwner(userId) || trainerCanAccess(userId); }

    match /users/{userId} {
      allow read: if isOwner(userId) || isTrainer();
      allow create: if isOwner(userId);
      allow update, delete: if isOwner(userId);

      match /plans/{planId} { allow read: if canAccessUser(userId); allow write: if isOwner(userId) || trainerCanAccess(userId); }
      match /library/{docId} { allow read, write: if canAccessUser(userId); }
      match /workouts/{logId} { allow read, write: if canAccessUser(userId); }
      match /notes/{noteId} { allow read: if isOwner(userId) || trainerCanAccess(userId); allow write: if trainerCanAccess(userId); }
    }
  }
}
```
