# Ajently

Ajently is a marketplace for AI agents where users can discover specialized agents, try them instantly, customize them, and pay for premium usage with fiat credits powered by Interswitch.

Live demo: [https://silver-goggles-gold.vercel.app/](https://silver-goggles-gold.vercel.app/)

## Problem

Many users want the value of AI agents without having to prompt-engineer from scratch, compare random tools across the internet, or manage complex workflows themselves. At the same time, creators need a simple way to package and monetize highly focused agents.

Ajently solves this by giving users:

- a clean marketplace to discover curated AI agents
- instant agent chat and testing
- a way to customize agents to their preferences
- a simple fiat credit top-up flow for paid usage

## Solution

Ajently turns AI agents into a usable marketplace product.

Users can:

- explore a curated agent marketplace
- open an agent details page
- chat with an agent in a focused workspace
- customize an agent’s identity, prompt, and attached knowledge
- create new agents through a form flow or a visual workflow builder
- top up credits with Interswitch checkout

## Interswitch APIs Used

This project uses Interswitch for fiat credit top-up.

### 1. Web Checkout API

Ajently uses Interswitch Web Checkout so users can top up credits with fiat currency through a hosted payment experience.

Use case in Ajently:

- user selects an amount on the credits page
- Ajently creates a pending top-up order
- user is redirected to Interswitch hosted checkout
- user pays with supported rails such as card

### 2. Server-side Transaction Confirmation / Requery

After redirect, Ajently confirms the payment on the server before credits are issued.

Use case in Ajently:

- Interswitch redirects the user back to `/credits/confirm`
- Ajently calls the confirmation endpoint server-side
- credits are only added after a successful verified transaction response

This prevents issuing credits based only on a browser redirect.

## Core Features

- Authentication with Google, email/password, or wallet
- Onboarding flow for name, email, and profile setup
- Explore page with search, filters, sorting, and pagination
- Three specialized launch agents:
  - Viral Hook Architect
  - Pull Request Reviewer
  - Socratic Tutor
- Agent detail pages with pricing, features, reviews, related agents, and customization entry points
- Chat interface with markdown rendering, copy/share/feedback actions, and file attachment support
- Agent customization page for prompt, identity, and knowledge tuning
- Form-based agent creation
- Visual workflow builder for agent creation
- Credits and billing dashboard
- Fiat top-up powered by Interswitch

## Demo Flow

Recommended demo order:

1. Open the live app
2. Sign in
3. Explore the marketplace
4. Open `Viral Hook Architect`
5. Try the agent in chat
6. Show markdown-style agent output
7. Open the credits page
8. Start an Interswitch top-up flow
9. Return to the marketplace and show that premium usage is tied to credits
10. Show agent creation or customization

## Screens To Show In Your Recording

- Login page
- Explore marketplace
- Agent details page
- Chat page
- Credits page with Interswitch option
- Agent customization page
- Optional: visual builder

## Tech Stack

- Next.js 16 App Router
- TypeScript
- Tailwind CSS
- SQLite via `sql.js`
- Auth.js for Google auth
- RainbowKit / wagmi for wallet connectivity
- OpenRouter for model access
- Interswitch Web Checkout for fiat payments

## Project Structure

- `app/` application routes and API routes
- `components/` reusable UI components
- `lib/` core business logic, database, auth, payments, and agent services
- `data/` local SQLite database and knowledge files

## Main Routes

- `/` Explore marketplace
- `/auth` Login / sign up
- `/onboarding` Profile setup
- `/agents/[id]` Agent details
- `/agents/[id]/chat` Chat with agent
- `/agents/[id]/customize` Customize agent
- `/create` Choose agent creation flow
- `/create/form` Form-based agent creation
- `/create/builder` Visual workflow builder
- `/credits` Credits and billing
- `/profile` Workspace / profile

## Main API Routes

- `POST /api/auth`
- `POST /api/auth/google/complete`
- `POST /api/auth/onboarding`
- `GET /api/profile`
- `GET /api/agents`
- `POST /api/agents`
- `POST /api/agents/[id]/run`
- `POST /api/credits`
- `POST /api/credits/[id]/confirm`
- `POST /api/webhooks/payments`

## Local Setup

1. Install dependencies

```bash
npm install
```

2. Add environment variables in `.env`

Minimum examples:

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

3. Run the app

```bash
npm run dev
```

4. Open:

```text
http://localhost:3000
```

## Team Contributions

### Godspower OjinI

- Product engineering
- Frontend implementation
- Backend and API integration
- Interswitch payment integration
- Authentication and onboarding flow
- Agent marketplace, chat, customization, and builder implementation
- Deployment and technical delivery

### Ifeoma Joy Okorie

- Product management
- Product planning and feature direction
- User flow definition
- Requirement shaping and delivery coordination
- Non-technical product contribution and execution support

## Notes For Judges

- Ajently is a live working MVP, not a slide-only concept
- The project demonstrates a real Interswitch-powered fiat top-up flow
- Credits are only issued after server-side payment confirmation
- The app includes both marketplace discovery and agent interaction workflows

## Submission Checklist

- Public GitHub repository
- Live accessible demo link
- README with team contributions
- Working MVP deployed and demo-ready

