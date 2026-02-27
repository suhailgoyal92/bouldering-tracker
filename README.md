# Bouldering Tracker

A simple, single-page web app for tracking bouldering attempts, sends, and progression over time.

## Features

- Add one entry per climb attempt
- Required field validation for date and problem name
- Local storage persistence (no backend needed)
- Filter by grade
- Toggle to show sent climbs only
- Search climbs by problem name (case-insensitive)
- Sort by newest, oldest, highest grade, or most attempts
- Inline edit for existing entries
- Delete single entries or clear all data
- Stats overview:
  - Total entries
  - Total sends
  - Send rate
  - Highest grade sent (excluding `Project`)
  - Sends by grade (`V0` to `V10`)

## Project Structure

- `index.html` – semantic page structure and UI sections
- `styles.css` – responsive, modern styling for mobile and desktop
- `app.js` – form handling, localStorage, table rendering, filtering/sorting, and stats

## Run Locally

No install step is required.

1. Clone or download this repository.
2. Open `index.html` in your browser.

That’s it — all data is stored in your browser via `localStorage`.

## Deploy with GitHub Pages

1. Push this repository to GitHub.
2. Go to **Settings** → **Pages**.
3. Under **Build and deployment**:
   - Set **Source** to **Deploy from a branch**
   - Select your branch (for example `main`) and folder `/ (root)`
4. Save.
5. After a minute, GitHub will provide a live URL to your app.

## Architecture Notes

- The app uses a small in-memory array of entries synchronized to `localStorage`.
- Every UI action (add/edit/delete/filter/sort) triggers a re-render of table and stats.
- Inline editing is row-based: selecting **Edit** swaps display cells for form controls, then **Save** persists changes.
- Grade handling uses a helper rank function for sorting and highest-grade calculation.
