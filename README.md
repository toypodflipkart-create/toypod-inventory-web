# TOYPOD Mobile Inventory Dashboard

This is a mobile-friendly static web dashboard for your **E-COMMERCE INVENTORY SHEET**.

It is designed for this workflow:

**Google Sheet → Google Apps Script JSON API → GitHub Pages website**

When you update Production, Dispatch, Returns, Box Purchase, or any formula dashboard in Google Sheets, the website refreshes dynamically and shows the new data.

---

## Included files

```text
index.html                 Main webpage
config.js                  Add your Google Apps Script API URL here
config.example.js          Example config
assets/styles.css          Professional responsive UI and mobile bottom tabs
assets/app.js              Dashboard logic + live data fetch + row cleanup
data/sample-data.json      Demo data from your uploaded Excel sheet
apps-script/Code.gs        Google Apps Script API for your Google Sheet
```

---

## Professional v2 updates

- Cleaner executive-style hero and KPI cards.
- Mobile bottom navigation for easier thumb use.
- Critical items sort first: out of stock, reorder, monitor, then sufficient.
- Safer frontend rendering with HTML escaping for Google Sheet values.
- Box note/helper rows are hidden automatically. The frontend and Apps Script both remove rows like:
  - `SUFFICIENT > 1.5× min / MONITOR / REORDER NOW / OUT OF STOCK`
  - `Returns are logged...`
- The box cards no longer show the unwanted `Min stock: 0` subtitle.
- Box minimum stock appears only as a clean stat when it is a real positive value.

## Step 1 — Upload Excel to Google Sheets

1. Open Google Drive.
2. Upload `E-COMMERCE INVENTORY SHEET(1).xlsx`.
3. Open it with Google Sheets.
4. Confirm these sheet names remain exactly the same:
   - SKU Master
   - Daily Production
   - Dispatch
   - Returns
   - Inventory Dashboard
   - Party Sales Summary
   - Management MIS
   - Box Purchase Log
   - Box Stock Tracker

---

## Step 2 — Create the Google Apps Script API

1. In Google Sheets, go to **Extensions → Apps Script**.
2. Delete any existing starter code.
3. Copy everything from `apps-script/Code.gs` and paste it into Apps Script.
4. Save the project.
5. Click **Deploy → New deployment**.
6. Select **Web app**.
7. Use these settings:
   - **Execute as:** Me
   - **Who has access:** Anyone
8. Deploy and copy the Web App URL. It will look like:

```text
https://script.google.com/macros/s/XXXXXXXXXXXX/exec
```

---

## Step 3 — Connect the website to your Google Sheet

Open `config.js` and replace the blank API URL:

```js
window.APP_CONFIG = {
  API_URL: "https://script.google.com/macros/s/YOUR_DEPLOYMENT_ID/exec",
  REFRESH_SECONDS: 60,
  BUSINESS_NAME: "TOYPOD"
};
```

The page refreshes automatically every 60 seconds. You can change `REFRESH_SECONDS` to 30, 120, etc.

---

## Step 4 — Publish on GitHub Pages

1. Create a new GitHub repository, for example: `toypod-inventory-dashboard`.
2. Upload all files from this folder.
3. Go to **Repository Settings → Pages**.
4. Set source to your main branch and root folder.
5. Save.
6. GitHub will give you a live URL like:

```text
https://your-username.github.io/toypod-inventory-dashboard/
```

---

## What appears on the web page

- Management MIS metric cards
- SKU inventory cards with search and status filter
- Box stock tracker with reorder alerts
- Party-wise sales summary
- Recent logs from production, dispatch, returns, and box purchases

---

## Important security note

If you deploy the Apps Script web app as **Anyone**, anyone with the API URL can read the data returned by the script. Do not include private, sensitive, or customer data in the connected sheets unless you add authentication later.

---

## Editing the design

Most color, spacing, and mobile layout changes are inside:

```text
assets/styles.css
```

Most data logic is inside:

```text
assets/app.js
```
