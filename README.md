# Mahim Dev — Full-Stack Developer Portfolio & Dynamic CMS

A production-ready full-stack developer portfolio and Content Management System (CMS) engineered with **React 19**, **TypeScript**, **Tailwind CSS v4**, **Node.js**, **Express.js**, and **MongoDB (Mongoose)**.

Every public page (`Home`, `About`, `Services`, `Projects`, `Project Case Study`, and `Contact`) is dynamically hydrated from MongoDB and managed through a protected `/admin` CMS dashboard with JWT + HttpOnly cookie authentication, Zod schema validation, role-protected REST APIs, inquiry management, and analytics tracking.

---

## 1. Architecture Overview

```text
├── public/                       # Static favicon & public uploads fallback
├── server/
│   └── src/
│       ├── app.ts                # Express app factory, security headers, API v1 & SPA mount
│       ├── config/
│       │   ├── database.ts       # MongoDB Atlas connection + zero-config MongoMemoryServer dev mode
│       │   └── env.ts            # Typed environment configuration & status flags
│       ├── controllers/          # Modular REST controllers (Auth, Projects, Services, About, CMS, Messages, Analytics, Upload)
│       ├── middleware/           # JWT/Cookie auth guard, Helmet, CORS, Rate Limiters, Multer upload, Central Error Handler
│       ├── models/               # 13 Mongoose schemas with indexes (Admin, Project, Service, About, Timeline, Testimonial, Skill, Message, FAQ, Pricing, SiteSettings, Analytics, MediaAsset)
│       ├── routes/
│       │   └── v1.ts             # Versioned /api/v1/* REST router
│       ├── scripts/
│       │   ├── createAdmin.ts    # CLI utility to provision or update Admin credentials
│       │   └── seed.ts           # Deterministic MongoDB seed script
│       ├── services/
│       │   ├── emailService.ts   # Optional Nodemailer SMTP notification & reply service
│       │   └── seedService.ts    # Idempotent portfolio content seeder
│       ├── utils/                # AppError & XSS/input sanitization helpers
│       └── validations/          # Server-side Zod schemas & unit tests
├── src/
│   ├── assets/images/            # High-resolution local portfolio & project showcase assets
│   ├── components/common/        # BrandLogo, DynamicIcon, ResilientImage, ProjectCard, ContactCtaBanner, ConfirmDialog, ImageUploaderField
│   ├── context/                  # AuthContext, SiteContext (dynamic CMS + SEO sync), ToastContext
│   ├── layouts/                  # PublicLayout (glassmorphic navbar/footer) & AdminLayout (collapsible CMS sidebar)
│   ├── pages/
│   │   ├── Home/                 # Hero, Featured Projects, Solutions Showcase, Why Work With Me, Stats + Testimonial, Contact CTA
│   │   ├── About/                # Bio, Story, Capabilities, Categorized Skills, Career Timeline
│   │   ├── Services/             # Service Grid, Detail Modal, 4-Step Workflow, Pricing Packages, FAQ Accordion
│   │   ├── Projects/             # Search + Category Filter Grid & Slug-based Case Study Detail Page
│   │   ├── Contact/              # Validated Inquiry Form, Direct Channels, Socials, Availability Card
│   │   └── admin/                # Login, Overview, Update Banner, Projects, Services, About, Skills, Testimonials, Pricing, FAQ, Messages, Site/SEO/Social Settings, Analytics, Admin Profile
│   ├── services/api.ts           # Axios client with credentials & Bearer token fallback
│   ├── types/portfolio.ts        # Shared TypeScript interfaces
│   ├── utils/                    # Pure filtering/sorting/validation logic & unit tests
│   └── validations/              # Client-side Zod + React Hook Form schemas
└── server.ts                     # Unified Express + Vite dev middleware / production static server on port 3000
```

---

## 2. Quick Installation & Run Commands

```bash
# 1. Install dependencies
npm install

# 2. Copy environment template and configure secrets
cp .env.example .env

# 3. Start full-stack development server (Express API + Vite SPA on http://localhost:3000)
npm run dev
```

### Production Build & Execution

```bash
# Type-check with TypeScript
npm run lint

# Build optimized Vite production frontend into dist/
npm run build

# Start production server on PORT (default 3000)
npm start
```

### Automated Unit & Integration Tests

```bash
npm test
```

---

## 3. Environment Configuration (`.env`)

Copy `.env.example` to `.env` and configure the variables below:

| Variable | Required | Description |
| :--- | :--- | :--- |
| `PORT` | Optional | Server port (defaults to `3000`) |
| `NODE_ENV` | Optional | `development` or `production` |
| `CLIENT_URL` / `ALLOWED_ORIGINS` | Optional | Trusted origin(s) for credentialed CORS requests |
| `MONGODB_URI` | Production | MongoDB connection string (`mongodb+srv://...` or `mongodb://127.0.0.1:27017/mahim_portfolio`). When omitted in development, an isolated `MongoMemoryServer` starts automatically and seeds initial portfolio data. |
| `JWT_SECRET` | Production | Strong 32+ character secret used to sign admin JWT tokens |
| `JWT_EXPIRES_IN` | Optional | Token lifetime (default `7d`) |
| `INITIAL_ADMIN_NAME` | Optional | Seeded admin display name (`Mahim Dev`) |
| `INITIAL_ADMIN_EMAIL` | Optional | Seeded admin email (`admin@mahimdev.com`) |
| `INITIAL_ADMIN_PASSWORD` | Optional | Seeded admin password (`Admin@12345` — rotate immediately in production) |
| `EMAIL_SERVICE_HOST`, `EMAIL_SERVICE_PORT`, `EMAIL_SERVICE_USER`, `EMAIL_SERVICE_PASSWORD`, `EMAIL_FROM_ADDRESS` (or `SMTP_*` aliases) | Optional | Enables outbound email replies from `/admin/messages` |
| `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` | Optional | Optional Cloudinary signed upload integration; falls back cleanly to local Multer storage + MongoDB `MediaAsset` persistence |

---

## 4. MongoDB & MongoDB Atlas Setup

### Option A: MongoDB Atlas (Recommended for Production)
1. Create a cluster at [MongoDB Atlas](https://www.mongodb.com/atlas).
2. Create a database user with `readWrite` access and allow your server IP under **Network Access**.
3. Set `MONGODB_URI` in `.env`:
   ```env
   MONGODB_URI=mongodb+srv://<username>:<password>@<cluster>.mongodb.net/mahim_portfolio?retryWrites=true&w=majority
   ```
4. Seed initial portfolio content:
   ```bash
   npm run seed
   ```

### Option B: Local MongoDB Community Server
1. Start local `mongod` on port `27017`.
2. Set `MONGODB_URI=mongodb://127.0.0.1:27017/mahim_portfolio` in `.env`.
3. Run `npm run seed`.

---

## 5. Admin Account Creation & Management

In development mode, the database automatically seeds an initial administrator if the `admins` collection is empty.

To provision or rotate an administrator account manually against your configured `MONGODB_URI`:

```bash
npm run create-admin -- --email="admin@yourdomain.com" --password="StrongPassword@2026" --name="Mahim"
```

You can also update your name, avatar, email, and password directly inside `/admin/profile` after signing in.

---

## 6. Versioned REST API Overview (`/api/v1`)

- **System & SEO**: `GET /api/v1/health`, `GET /robots.txt`, `GET /sitemap.xml`
- **Authentication**: `POST /api/v1/auth/login`, `POST /api/v1/auth/logout`, `GET /api/v1/auth/session`, `GET /api/v1/auth/me`, `PUT /api/v1/auth/me`, `PUT /api/v1/auth/change-password`
- **Projects**: `GET /api/v1/projects`, `PUT /api/v1/projects/reorder`, `GET /api/v1/projects/:id`, `POST /api/v1/projects`, `PUT /api/v1/projects/:id`, `DELETE /api/v1/projects/:id`
- **Services**: `GET /api/v1/services`, `GET /api/v1/services/:id`, `POST /api/v1/services`, `PUT /api/v1/services/:id`, `DELETE /api/v1/services/:id`
- **About & Timeline**: `GET /api/v1/about`, `GET /api/v1/about/cv-download`, `PUT /api/v1/about`, `POST /api/v1/about/timeline`, `PUT /api/v1/about/timeline/:id`, `DELETE /api/v1/about/timeline/:id`
- **CMS Collections**: `/api/v1/skills`, `/api/v1/testimonials`, `/api/v1/pricing`, `/api/v1/faq`, `/api/v1/settings`
- **Contact & Inquiries**: `POST /api/v1/messages` (rate-limited + honeypot protected), `GET /api/v1/messages`, `GET /api/v1/messages/:id`, `PUT /api/v1/messages/:id`, `DELETE /api/v1/messages/:id`
- **Analytics & Media**: `POST /api/v1/analytics/track`, `GET /api/v1/analytics/overview`, `GET /api/v1/analytics/visitors`, `GET /api/v1/analytics/pages`, `GET /api/v1/upload`, `POST /api/v1/upload`, `DELETE /api/v1/upload/:id`

---

## 7. Troubleshooting

- **Port 3000 already in use**: Stop any existing process bound to port `3000` or change `PORT` in `.env` for standalone deployments.
- **Admin session expires or returns `401`**: Verify `JWT_SECRET` has not changed between restarts and cookies are enabled in your browser.
- **Email reply saves in database without sending an email**: This is expected when `EMAIL_SERVICE_HOST` / `EMAIL_SERVICE_USER` / `EMAIL_SERVICE_PASSWORD` (or `SMTP_*`) are not set in `.env`. Configure SMTP credentials to enable live email delivery alongside database persistence.
