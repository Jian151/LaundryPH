# LaundryPH

LaundryPH is a Flask-based laundry booking and tracking web app.

## Features
- User registration and login
- Laundry booking
- Order tracking
- Order history and profile pages
- Admin dashboard for managing orders and services

## Run locally

```bash
pip install -r requirements.txt
python app.py
```

Open http://127.0.0.1:5000 in your browser.

## Deploy to Firebase Hosting

1. Install Node.js and Firebase CLI.
2. Run:

```bash
npm install -g firebase-tools
firebase login
firebase deploy
```

The project already includes `.firebaserc` and `firebase.json` for the `laundryph-71e55` Firebase project.
