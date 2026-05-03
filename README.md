# Ajently
 
Ajently is an AI agent marketplace where users can discover specialized agents, try them instantly, customize them to their needs, and pay for premium usage with fiat credits powered by Interswitch.
 
**Live demo:** [https://silver-goggles-gold.vercel.app/](https://silver-goggles-gold.vercel.app/)
 
---
 
## Problem
 
AI is fragmented. You use one tool to write, another to review code, another to tutor you, another to generate content — and none of them talk to each other. Most people want the power of AI agents without the friction of jumping between a dozen different platforms, prompt-engineering from scratch each time, or managing complex workflows on their own.
 
At the same time, creators who build highly focused, specialized agents have no clean way to package or monetize their work.
 
Ajently fixes both sides of this equation by bringing different models and agents together in one place — so users can go from task to task without switching platforms, and creators can build, list, and earn from their agents.
 
---
 
## Solution
 
Ajently turns AI agents into a usable, unified marketplace product.
 
**For users:**
- Explore a curated marketplace of specialized AI agents across different use cases
- Open an agent's detail page and understand exactly what it does
- Chat with an agent in a focused, distraction-free workspace
- Customize an agent's identity, system prompt, and attached knowledge
- Create new agents through a guided form flow or a visual workflow builder
- Top up credits with fiat currency via Interswitch checkout
**For creators:**
- Package focused agents and list them on the marketplace
- Earn platform credits when paid agents are used (fiat payouts planned as a future upgrade)
---
 
## Interswitch Integration
 
Ajently uses Interswitch to power fiat credit top-ups — the core monetization layer of the marketplace.
 
### 1. Web Checkout API
 
Users select a credit amount on the billing page. Ajently creates a pending top-up order and redirects the user to Interswitch's hosted checkout to complete payment via card or other supported rails.
 
### 2. Server-side Transaction Confirmation (Requery)
 
After the user is redirected back, Ajently confirms the payment server-side before issuing any credits. This prevents credits from being added based on a browser redirect alone — only a verified transaction response from Interswitch triggers a credit update.
 
**Confirmation flow:**
- Interswitch redirects user to `/credits/confirm`
- Ajently calls the requery endpoint server-side
- Credits are issued only after a successful verified response
---
 
## Core Features
 
- **Authentication** — Google OAuth, email/password, and wallet login
- **Onboarding** — Name, email, and profile setup flow
- **Explore page** — Search, filters, sorting, and pagination across the agent marketplace
- **Three specialized launch agents:**
  - Viral Hook Architect
  - Pull Request Reviewer
  - Socratic Tutor
- **Agent detail pages** — Pricing, features, reviews, related agents, and customization entry points
- **Chat interface** — Markdown rendering, copy/share/feedback actions, and file attachment support
- **Agent customization** — Prompt tuning, identity editing, and knowledge attachment
- **Agent creation** — Form-based flow and a visual workflow builder
- **Credits and billing dashboard** — Balance overview and top-up history
- **Fiat top-up** — Powered by Interswitch Web Checkout with server-side confirmation
---
 
## Demo Flow
 
Recommended demo order:
 
1. Open the live app
2. Sign in
3. Explore the marketplace
4. Open `Viral Hook Architect`
5. Try the agent in the chat workspace
6. Show markdown-style agent output
7. Open the credits page
8. Start an Interswitch top-up flow
9. Return to the marketplace and show that premium usage is tied to credits
10. Show agent creation or customization
---
 
## Screens to Show in Your Recording
 
- Login page
- Explore marketplace
- Agent details page
- Chat page
- Credits page with Interswitch option
- Agent customization page
- Optional: visual workflow builder
---
 
## Tech Stack
 
| Layer | Technology |
|---|---|
| Framework | Next.js 16 (App Router) |
| Language | TypeScript |
| Styling | Tailwind CSS |
| Database | SQLite via `sql.js` |
| Auth | Auth.js (Google OAuth + email/password) |
| Wallet | RainbowKit / wagmi |
| AI Models | OpenRouter |
| Payments | Interswitch Web Checkout |
 
---
 
## Project Structure
 
```
app/          → Application routes and API routes
components/   → Reusable UI components
lib/          → Core business logic, database, auth, payments, and agent services
data/         → Local SQLite database and agent knowledge files
```
 
---
 
## Main Routes
 
| Route | Description |
|---|---|
| `/` | Explore marketplace |
| `/auth` | Login / sign up |
| `/onboarding` | Profile setup |
| `/agents/[id]` | Agent details |
| `/agents/[id]/chat` | Chat with agent |
| `/agents/[id]/customize` | Customize agent |
| `/create` | Choose agent creation flow |
| `/create/form` | Form-based agent creation |
| `/create/builder` | Visual workflow builder |
| `/credits` | Credits and billing |
| `/profile` | Workspace / profile |
 
---
 
## Main API Routes
 
| Method | Route | Purpose |
|---|---|---|
| POST | `/api/auth` | Authentication |
| POST | `/api/auth/google/complete` | Google OAuth completion |
| POST | `/api/auth/onboarding` | Onboarding setup |
| GET | `/api/profile` | Fetch user profile |
| GET | `/api/agents` | List agents |
| POST | `/api/agents` | Create agent |
| POST | `/api/agents/[id]/run` | Run agent |
| POST | `/api/credits` | Initiate top-up |
| POST | `/api/credits/[id]/confirm` | Confirm payment server-side |
| POST | `/api/webhooks/payments` | Interswitch payment webhook |
 
---
 
## Local Setup
 
**1. Install dependencies**
 
```bash
npm install
```
 
**2. Add environment variables in `.env`**
 
```env
AUTH_SECRET=
AUTH_GOOGLE_CLIENT_ID=
AUTH_GOOGLE_CLIENT_SECRET=
NEXT_PUBLIC_APP_URL=http://localhost:3000
OPENROUTER_API_KEY=
OPENROUTER_DEFAULT_MODEL=openai/gpt-oss-120b:free
INTERSWITCH_ENV=sandbox
INTERSWITCH_MERCHANT_CODE=
INTERSWITCH_PAY_ITEM_ID=
INTERSWITCH_DEFAULT_CUSTOMER_EMAIL=
INTERSWITCH_WEBHOOK_SECRET=
```
 
**3. Run the development server**
 
```bash
npm run dev
```
 
**4. Open in your browser**
 
```
http://localhost:3000
```
 
---
 
## Team
 
### Godspower Ojini — Product Engineer
- Full product engineering and technical delivery
- Frontend implementation (marketplace, chat, customization, builder)
- Backend and API integration
- Interswitch payment integration (checkout + server-side confirmation)
- Authentication and onboarding flow
- Deployment
### Ifeoma Joy Okorie — Product Manager
- Product planning and feature direction
- User flow definition
- Requirement shaping and delivery coordination
- Non-technical product contribution and execution support
---
 
## Notes for Judges 😎
 
- Ajently addresses a real fragmentation problem in AI — users no longer need to jump between multiple tools and platforms for different AI tasks
- The Interswitch integration powers a real fiat top-up flow with server-side payment confirmation before any credits are issued
- The app includes both marketplace discovery and agent interaction workflows, demonstrating the full creator-to-user monetization loop
---
 
## Submission Checklist
 
- [x] Public GitHub repository
- [x] Live accessible demo link
- [x] README with team contributions
- [x] Walkthrough Video
- [x] Working MVP deployed and demo-ready
