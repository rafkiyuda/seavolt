# SeaVolt – Powering Every Voyage

Mobile-first web app prototype for **SeaVolt**, a battery-swap energy service for Indonesian fishing boats
(Team PIKAPI – BPC Semifinal, Sustainable Energy and Electrification). Pay per trip (Rp85,000), Rp0 upfront.

## Features (from the proposal)
- Battery & range check (4 × 2.56 kWh LFP packs, 30% return alert)
- Dock Station finder & swap-slot booking
- Payment: QRIS / bank transfer / cash, with weekly, monthly and 3-month packages
- Trip history & savings tracker vs petrol
- Safety alerts, location sharing & SOS
- Fleet dashboard + one monthly invoice (boat owners)
- Impact & ESG dashboard (litres replaced, CO2 avoided) with CSV export
- Help & maintenance requests

> Demo only: all data is simulated in the browser (localStorage). Package prices, petrol price and the QR code are illustrative.

## Run
No build step. Serve the folder with any static server, e.g.

```bash
python -m http.server 8080
```

then open http://localhost:8080 (best viewed at phone width).
