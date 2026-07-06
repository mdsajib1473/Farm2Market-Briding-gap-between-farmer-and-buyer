# Farm2Market AGENT.md: Extension Phase

## 1. Purpose of This Document

This document governs the next phase of development on Farm2Market. It defines scope, rules, and sequencing for three additions: farmer to farmer trading, bilingual Bangla/English support, and a delivery personnel account system. No code should be written for a feature until its section here is confirmed.

## 2. Scope of This Extension

Three features are being added to the existing Django app (`f2m_app`):

1. Farmer to farmer trading, so a farmer account can also buy from another farmer's listings, not just sell to buyers.
2. Full bilingual support (Bangla and English) across the platform.
3. A real delivery personnel account system with a login and dashboard, replacing the current static `Logistic` record.

Note on scope: farmer to farmer trading does not introduce a new "seller" concept. Only farmers can list products today, and that stays true. The only new capability is letting a farmer account use the cart and checkout, which is currently restricted to buyers only at the view level.

## 3. Rules

1. Never build beyond the current step. Complete and verify one phase before starting the next.
2. Always respond in the same language typed during development conversations (Bangla in, Bangla out).
3. Do not commit or push code. Sajib commits and pushes manually after testing. Ask first if a push seems necessary.
4. Write clean, well-commented code. Every function and class gets a docstring.
5. Follow secure coding practices: never expose secrets, always validate and sanitize user input before processing, enforce CORS and CSRF protections appropriate to each endpoint.
6. Write scalable code for new work: keep business logic out of views where practical, keep view functions thin, never hardcode values that belong in settings or `.env`. This applies to new code added for this extension, it is not a mandate to refactor the existing `views.py` unless separately requested.
7. Do not over-comment. Only comment where the code is not self-explanatory.
8. Log meaningful state changes for traceability. At minimum, every order status transition (who changed it, old status, new status, timestamp) should be reconstructable later. This matters more now that delivery assignment is automatic and multiple roles touch the same order.
9. No emojis and no em dashes anywhere: code comments, markdown files, commit messages, and all frontend copy. Use plain punctuation only. Note: `buyer_order_action_view` currently has a checkmark emoji in a notification string, this should be cleaned up as part of this work.

### Rules held in reserve (only if an AI feature is added later)

Farm2Market has no LLM component today. If the previously discussed Groq-based bilingual description generator, or an LLM-based price recommendation feature, gets greenlit, add a dedicated "AI Feature Rules" subsection at that point and carry over the equivalents of these, adapted from FounderCheck's rules:

- Any AI-generated output shown to a user gets a clear disclaimer stating it is AI-assisted and may need review, not a guaranteed accurate translation or price.
- Never fabricate output when an LLM call fails or returns incomplete data. Default to a clearly labeled pending or unavailable state, never a guessed value.
- Never pass raw, unsanitized user text directly into an LLM prompt, clean it first.
- Never let an LLM call fail silently, catch the error and fall back or surface a clear error.
- Respect free tier API limits, cache identical or near-identical LLM requests.

## 4. Roles (Updated)

- **Farmer**: existing role. Now dual purpose, can sell products as before, and can also buy from other farmers.
- **Buyer**: existing role, unchanged.
- **Delivery Personnel**: new role. Not self-registerable. Created only through Django admin. Linked to an existing `Logistic` company record.
- **Admin**: existing Django admin, now also responsible for creating delivery personnel accounts.

## 5. Feature A: Farmer to Farmer Trading

Rules:

- A buyer who wants to sell must register a farmer account. There is no separate "become a seller" flow and no admin approval step for selling, this reuses the exact registration and product listing flow farmers already have.
- No category or quantity restriction on what a farmer can sell to another farmer. Same rules as farmer to buyer sales today.
- Farmers can now access the cart, add to cart, and checkout views, which are currently gated to `role == 'buyer'` only. This gate needs to allow `role == 'farmer'` too.
- A farmer's dashboard needs a way to browse other farmers' listings and see their own purchase history as a buyer, alongside their existing selling dashboard.
- Payment stays offline or cash on delivery, same as the current farmer to buyer flow. No payment gateway in this phase.
- Farmer to farmer orders use the exact same `Order` model and status flow already in place (Order Placed, Confirmed, Delivery Assigned, Out for Delivery, Delivered, Completed), no separate order type.
- Assumption to confirm: a farmer cannot buy their own listed product. Standard self-purchase block at checkout.

## 6. Feature B: Bilingual Bangla/English Support

Rules:

- Use Django's real i18n framework: `.po`/`.mo` translation files, `{% trans %}` / `{% blocktrans %}` template tags, `LocaleMiddleware`, and URL prefixes (`/bn/`, `/en/`).
- Default language for a new or anonymous visitor is Bangla.
- Language selection logic:
  - Anonymous visitors: a toggle sets a `django_language` cookie.
  - Logged in users: preference also saves to `Profile` (new `language` field) and is applied on every login regardless of device. Profile setting overrides the cookie once logged in.
- Translation coverage is not limited to UI chrome. Farmers and buyers should be able to enter product name and description in both languages (for example `name_en` / `name_bn` fields on `Product`, and similarly on `Category`).
- Existing templates across the app will need `{% trans %}` tags added, this touches every template file, not just new ones.

## 7. Feature C: Delivery Personnel System

Rules:

- `delivery` is added as a third choice on `Profile.role`, but it is not selectable on the public `/register/` form. Accounts are created only through Django admin.
- Each delivery personnel account links to an existing `Logistic` company record (Pathao, Steadfast, etc), representing an employee of that company rather than an independent courier.
- Order assignment to a specific delivery person is automatic, not manually chosen by the farmer. First version can use a simple rule (for example round robin, or fewest active assigned orders), refine later if needed.
- Delivery dashboard shows: assigned orders, and the buyer's delivery address and contact info for each. It also needs to support moving an order through Out for Delivery to Delivered, since that is the core purpose of giving them a login at all.
- Farmer to farmer orders go through this exact same delivery and auto-assignment system, no separate path.

## 8. Non-Negotiables / Out of Scope for This Phase

- No payment gateway of any kind. All transactions remain cash on delivery or offline.
- No new "seller" role or tier separate from the existing farmer role.
- No manual delivery assignment UI for farmers, assignment is automatic.
- No public self-registration for delivery personnel.

## 9. Development Process Notes

- Active coding is solo for now (Sajib, using Claude Code), following the phased approach in Rule 1 above.
- Co-authors (nabil0203, turjo25) are not concurrent contributors in this phase. They may get involved later for testing and possibly a conference or research publication based on this work. If that happens, revisit this document to add a multi-developer workflow (branches, review) before they start committing code.
- No hard deadline currently attached to this extension.

## 10. Assumptions Requiring Confirmation

- Farmer cannot purchase their own product listing (self-purchase block).
- Delivery assignment algorithm starts simple (round robin or least loaded), can be revisited.
- Bilingual product fields are added directly on `Product` and `Category` models rather than a separate translation table, given the app's current size.
- `delivery` role is added to `Profile.ROLE_CHOICES` rather than a fully separate model, to reuse existing auth and permission patterns.

## 11. Suggested Build Phases

1. **Phase 1**: Farmer to farmer trading. Smallest change, mostly permission logic on existing cart/checkout views plus dashboard additions. No schema changes to `Order` or `Product` beyond the self-purchase check.
2. **Phase 2**: Bilingual infrastructure. Django i18n setup, translation files, template tags, language field on `Profile`, bilingual fields on `Product`/`Category`.
3. **Phase 3**: Delivery personnel accounts. New role, admin-only creation, auto-assignment logic, delivery dashboard.

Each phase should be completed and verified before the next begins, consistent with the existing project workflow.