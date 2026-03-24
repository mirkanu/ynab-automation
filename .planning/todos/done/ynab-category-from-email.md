---
title: Support specifying YNAB category as first line of forwarded email
type: future-phase
captured: 2026-03-24
---

When forwarding an order email, the user can optionally type a YNAB category name on the
first line of the forwarded message body (e.g. "Groceries" or "Electronics").
The webhook should detect this, look up the category ID in YNAB, and assign it to the transaction.
If no first line is present, leave uncategorized as today.
