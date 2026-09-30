# Integration Inventory

## 1. Configured in the current demo

| Integration area | Current provider name | Demo status | Paid? |
|---|---|---|---|
| ERP / accounting export | `mock-netsuite` | Connected sandbox record; no live NetSuite API calls | No demo charge. A real NetSuite account is a paid commercial service. |
| Accounting provider | `MOCK_QBO` | Connected sandbox record; idempotent mock sync | No demo charge. QuickBooks Online is a paid subscription service. |
| Travel booking | `mock-travel` | Search, hold, confirm, cancel, and refund are simulated | No demo charge. A live travel provider normally charges booking/service fees or requires a commercial contract. |
| Card issuer | `mock-issuer` | Virtual-card issue, authorization, capture, void, and reversal are simulated | No demo charge. A real issuer/processor normally charges program, network, interchange, or transaction fees. |

## 2. Implemented as mock adapters, but not connected to a named live provider

| Capability | Current adapter | Typical production choice | Paid? |
|---|---|---|---|
| Invoice/receipt OCR | `MockOcrAdapter` | Google Document AI, AWS Textract, Azure Document Intelligence, or Mindee | Usually usage-based paid; free tiers may exist. |
| Payment rail | `MockPaymentRailAdapter` | Bank/ACH provider such as Stripe Treasury, Modern Treasury, Plaid Transfer, or a bank partner | Usually transaction/contract fees; provider-specific. |
| Reimbursement payout | `MockPayoutAdapter` | Bank payout/ACH provider | Usually transaction fees or commercial pricing. |
| Email | `MockEmailAdapter` | Amazon SES, SendGrid, Mailgun, Postmark, or enterprise SMTP | Usually paid after a free tier; not configured in this demo. |
| Bank data | `MockBankDataAdapter` | Plaid, MX, Finicity, or bank APIs | Usually paid per connection/request or contract. |
| HRIS | `MockHrisAdapter` | Workday, BambooHR, HiBob, Rippling, or Gusto | Normally requires a paid customer account and integration access. |
| Identity / SSO | `MockIdentityAdapter` | Okta, Microsoft Entra ID, Auth0, or Google Workspace | Often paid by seat/MAU/plan; not configured. |
| Sanctions screening | `MockSanctionsScreeningAdapter` | ComplyAdvantage, Dow Jones, Refinitiv, or similar | Commercial/paid compliance service. |
| Tax filing | `MockTaxFilingAdapter` | Avalara, Vertex, TaxJar, or local tax provider | Commercial/paid service. |
| E-signature | `MockESignAdapter` | DocuSign, Adobe Acrobat Sign, or Dropbox Sign | Paid plan or per-envelope pricing is typical. |
| Collaboration | `MockCollaborationAdapter` | Slack, Microsoft Teams, or Google Chat | Usually part of a paid workspace plan. |
| Contracts | `MockContractAdapter` | Ironclad, DocuSign CLM, or similar CLM provider | Paid enterprise service. |
| Data export | `MockDataExportAdapter` | Customer warehouse, SFTP, object storage, or data platform | Depends on destination; no provider is configured. |
| AI usage / LLM | `MockAiUsageAdapter`, `MockLlmAdapter` | OpenAI or another model provider | Usually usage-based paid. The seed contains an OpenAI usage record, but no live model API is wired into this demo flow. |

## 3. What is safe to say in a demo

Use this wording:

> “The demo currently runs with sandbox adapters for cards, travel, payments, payouts, OCR, and accounting. The integration contracts are provider-neutral, so production providers can be connected later. No live external transaction is being claimed here.”

Do not say that NetSuite, QuickBooks, a card issuer, a bank, or a travel supplier is actively connected just because a `mock-*` connection appears in **Company → Integrations**.

## 4. Cost conclusion

- Current local/demo mode: no external integration subscription or usage charge is required.
- Production mode: most real providers in the tables above are paid, either by subscription, per transaction, per document, per user, per API call, or by enterprise contract.
- The repository does not contain vendor contracts, plan names, or negotiated prices. Exact pricing must be confirmed with each provider before presenting a cost estimate.

