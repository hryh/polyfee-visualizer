# Privacy Policy — Fee Lens for Polymarket

_Last updated: 13 September 2026_

## Short version

The extension collects nothing, sends nothing anywhere, and has no server.
Everything it computes stays in your browser.

## What it stores

One value, in `chrome.storage.local` on your own machine:

- a running count and dollar total of fees seen on orders you placed, plus the
  question text and fee of the most recent one, so the toolbar popup can show a
  tally.

Clearing it is a single button in the popup. Removing the extension deletes it.

## What it reads

On polymarket.com pages only:

- the page URL, to work out which market you are looking at;
- the number typed into the order-size box;
- outgoing requests to Polymarket's API, to learn which market is selected and,
  when you submit an order, its side, price and size.

Order payloads are read for side, price and size only. Wallet addresses,
signatures, private keys, API credentials, balances and personal details are
never read, stored or transmitted. The extension cannot place, alter, delay or
cancel an order — it wraps network calls only to observe them, forwarding every
one untouched.

## What it sends

Requests to two public Polymarket endpoints, to look up fee schedules and
prices:

- `https://gamma-api.polymarket.com`
- `https://clob.polymarket.com`

These are sent without credentials (`credentials: 'omit'`) and contain only a
market slug or token id. No identifier of you is attached.

There are no other network requests. No analytics, no telemetry, no crash
reporting, no advertising, no third-party scripts, and no remotely hosted code —
all logic ships inside the extension package.

## What it does not do

- No account, login or email.
- No selling or sharing of data, because none is collected.
- No tracking across sites; it runs only on polymarket.com.
- No access to browsing history, cookies, passwords or other tabs.

## Permissions, and why

| Permission | Why |
|---|---|
| `storage` | keep the local fee tally and panel position |
| `https://gamma-api.polymarket.com/*` | read each market's live fee schedule |
| `https://clob.polymarket.com/*` | read current best bid/ask for accurate pricing |
| content script on `polymarket.com` | draw the panel and read the order-size field |

No `tabs`, no `<all_urls>`, no `webRequest`, no background service worker.

## Contact

Open an issue on the project repository.
