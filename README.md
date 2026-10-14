# ConnectLive Prototype

A bilingual (Hindi/English) random video chat prototype with:
- One-time ₹1,000 entry-fee UI
- **Test-only simulated payment** (no real money is collected)
- Browser-local demo transaction history + CSV export
- WebSocket signaling and WebRTC video calling
- Next, mute, end call, report and block controls

## Requirements
- Node.js 18 or newer
- Internet access for `npm install`
- Camera/microphone and a modern browser

## Run locally
1. Extract the ZIP.
2. Open a terminal in the extracted `connectlive-prototype` folder.
3. Run `npm install`
4. Run `npm start`
5. Open `http://localhost:3000`

To test random matching, open the site in **two separate browser windows/devices**. Click **Try test payment** in each, then **Find someone** in both. Allow camera/microphone permissions.

Camera access works on `localhost` for local development. On a public server, use HTTPS and secure WebSockets (WSS). See MDN's `getUserMedia` and WebRTC signaling documentation:
- https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getUserMedia
- https://developer.mozilla.org/en-US/docs/Web/API/WebRTC_API/Signaling_and_video_calling

## Important prototype limitations
- Payment is simulated only. No payment gateway keys or live payment integration are included.
- The "paid" state and transaction history live in browser localStorage. They are **not secure**, are not shared with an admin, and must not be used as proof of payment.
- Matching queue and report events are in server memory and reset when the server restarts. Reports are not persisted or reviewed by moderators.
- This is a starter prototype, not production-ready. Before public launch, add verified gateway webhooks and server-side entitlement checks, a database, authentication, rate limiting, moderation operations, abuse controls, a privacy policy, terms, age protections, and security testing.
- The included public STUN server may not connect across all networks. A production deployment should use a managed or self-hosted TURN service.
- Do not put real users or real payments through this prototype.

## Project structure
- `server.js` — HTTP server, WebSocket signaling, random match queue
- `public/index.html` — bilingual UI
- `public/style.css` — responsive design
- `public/app.js` — simulated payment, transaction demo, WebRTC client
