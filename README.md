# KR Production System

Production Management System for Kayaar Exports Private Limited - Smart Spin Lite

## Technology Stack

- **Framework:** Next.js 15 (App Router)
- **Styling:** Tailwind CSS + Shadcn UI
- **Database:** Supabase (PostgreSQL)
- **State Management:** Zustand
- **Form Handling:** React Hook Form + Zod
- **Icons:** Lucide React

## Getting Started

### Prerequisites
- Node.js 18+ installed
- Supabase account and project

### Installation

1. Navigate to project directory
```bash
cd d:\Ai-Projects\ERP-Project\kr-production-system
```

2. Install dependencies (already completed)
```bash
npm install
```

3. Configure environment variables
Update `.env.local` with your Supabase credentials:
```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

4. Run the development server
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to view the application.

## Project Structure

```
kr-production-system/
├── src/
│   ├── app/                    # Next.js App Router pages
│   │   ├── layout.js          # Root layout with sidebar
│   │   ├── page.js            # Dashboard home
│   │   └── masters/           # Master data modules
│   ├── components/
│   │   ├── ui/                # Shadcn UI components
│   │   ├── common/            # Reusable components
│   │   └── modules/           # Feature-specific components
│   ├── lib/
│   │   ├── supabase.js        # Supabase client
│   │   └── utils.js           # Utility functions
│   └── hooks/                 # Custom React hooks
├── public/                    # Static assets
└── .env.local                # Environment variables
```

## Modules Implemented

### Master Data
- ✅ Project Setup Complete
- ⏳ Department Master
- ⏳ Spinning Machine Master
- ⏳ Stoppage Head Master
- ⏳ Spinning Count Master
- ⏳ HOKStrength Master
- ⏳ Supervisor Master
- ⏳ Autocorner Machine Master
- ⏳ TPI Entry Master
- ⏳ TWC Entry Master

## Development

### Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run lint` - Run ESLint

### Installed Packages

**Core Dependencies:**
- next, react, react-dom
- @supabase/supabase-js, @supabase/ssr
- zustand (state management)
- react-hook-form, @hookform/resolvers, zod (forms)
- date-fns (date utilities)
- lucide-react (icons)
- clsx, tailwind-merge (utilities)

**Shadcn UI Components:**
- button, input, label, card, dialog
- table, select, dropdown-menu
- checkbox, separator, sonner (toast)

### Code Style

- Use functional components with hooks
- Follow Next.js App Router conventions
- Use Tailwind utility classes for styling
- Shadcn UI components for consistent design
- Orange theme for primary color

## Database Setup

Refer to `../plan.md` Phase 10 for complete database schema and Supabase setup instructions.

## Next Steps

1. Set up Supabase project and get credentials
2. Update `.env.local` with Supabase credentials
3. Create database tables using SQL from plan.md
4. Start building master modules

## License

Proprietary - All rights reserved by Kayaar Exports Private Limited (2025-2026)

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
