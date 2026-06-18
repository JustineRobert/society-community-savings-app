# Multi-Tenant Architecture

## 1. Overview
This platform is a multi-tenant SaaS system where multiple SACCOs operate independently on a shared infrastructure.

Each SACCO is treated as a **Tenant**, with strict logical isolation enforced across all system components.

---

## 2. Tenant Model

### Tenant Schema
```json
{
  "_id": "ObjectId",
  "name": "SACCO Name",
  "status": "active",
  "config": {
    "currency": "UGX",
    "loanSettings": {},
    "limits": {}
  },
  "createdAt": "ISODate"
}