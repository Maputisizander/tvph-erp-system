# TelcoVantage ERP — Vendor List API Guide

This document explains how to retrieve the vendor list from the TelcoVantage ERP system. Your system calls this API whenever it needs the current vendor data.

## 1. Endpoint

```
GET https://erp.telcovantage.com/api/vendors
```

## 2. Authentication

Every request must include an API key in the `Authorization` header. The key was provided to you separately.

| Header | Value |
|--------|-------|
| `Authorization` | `Bearer <YOUR_API_KEY>` |

Requests without a valid key return `401 Unauthorized`.

## 3. Example Request

### cURL

```bash
curl -H "Authorization: Bearer <YOUR_API_KEY>" \
  https://erp.telcovantage.com/api/vendors
```

### JavaScript

```js
const res = await fetch("https://erp.telcovantage.com/api/vendors", {
  headers: { Authorization: `Bearer ${API_KEY}` },
});

if (!res.ok) throw new Error(`Request failed: ${res.status}`);
const vendors = await res.json();
```

### Python

```python
import requests

res = requests.get(
    "https://erp.telcovantage.com/api/vendors",
    headers={"Authorization": f"Bearer {API_KEY}"},
)
res.raise_for_status()
vendors = res.json()
```

## 4. Response

A JSON array of vendors, sorted by name. Each vendor contains these fields:

```json
[
  {
    "id": "f724182b-298f-4901-accf-eff3b28f76dd",
    "vendor_code": "1000024",
    "name": "ACEUP CABLING INSTALLATION SERVICES",
    "status": "active",
    "address": "123 Main St, Manila",
    "contact_person": "Juan Dela Cruz",
    "contact_phone": "+63 912 345 6789",
    "contact_email": "juan@aceup.com"
  }
]
```

| Field | Type | Description |
|-------|------|-------------|
| `id` | string (UUID) | Unique vendor identifier, stable across calls |
| `vendor_code` | string or `null` | Vendor code; some vendors may not have one yet |
| `name` | string | Vendor business name |
| `status` | string | One of `pending`, `active`, `inactive` |
| `address` | string or `null` | Vendor street address |
| `contact_person` | string or `null` | Primary contact name |
| `contact_phone` | string or `null` | Primary contact phone number |
| `contact_email` | string or `null` | Primary contact email |

Notes:

- Data is always current — there is no caching, so treat every response as live.
- Soft-deleted vendors are never included.
- No pagination — the response always contains the full vendor list.

## 5. Error Responses

| Status | Body | Meaning |
|--------|------|---------|
| `401` | `{"error":"Unauthorized"}` | Missing or invalid API key |
| `500` | `{"error":"<message>"}` | Server/database error — retry after a short delay |

## 6. Usage Tips

- Keep the API key secret. Store it as an environment variable or secret manager value — never in source code or client-side code.
- If the key is ever compromised, contact us; it will be rotated.
- The endpoint has no rate limit, but please poll reasonably (e.g. no more than once per minute) to avoid unnecessary load.

For questions or key changes, contact the ERP administrator.
