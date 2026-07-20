# Smart Spin Lite - Production Management System
## Development Plan

### Company: Kayaar Exports Private Limited (2025-2026)
### Project Name: KR Production System

---

## Phase 1: Project Setup

### 1.1 Initialize Next.js Application
```bash
# Create Next.js app in current directory
npx create-next-app@latest kr-production-system

# Select the following options:
# ✓ Would you like to use TypeScript? No
# ✓ Would you like to use ESLint? Yes
# ✓ Would you like to use Tailwind CSS? Yes
# ✓ Would you like to use `src/` directory? Yes
# ✓ Would you like to use App Router? Yes
# ✓ Would you like to customize the default import alias? No

cd kr-production-system
```

**✅ Status: Project Created & Initialized**
- Location: `d:\Ai-Projects\ERP-Project\kr-production-system`
- Next.js Version: 15 (App Router)
- Created: November 19, 2025
- Shadcn UI: Initialized with orange theme
- Dependencies: Installed (Supabase, Zustand, React Hook Form, etc.)
- Supabase Client: Created at `src/lib/supabase.js`
- Environment: `.env.local` file created

### 1.2 Install Shadcn UI Components
```bash
# Initialize shadcn/ui
npx shadcn-ui@latest init

# Select the following options:
# ✓ Would you like to use TypeScript? No
# ✓ Which style would you like to use? Default
# ✓ Which color would you like to use as base color? Orange
# ✓ Where is your global CSS file? src/app/globals.css
# ✓ Would you like to use CSS variables for colors? Yes
# ✓ Where is your tailwind.config.js located? tailwind.config.js
# ✓ Configure the import alias for components? @/components
# ✓ Configure the import alias for utils? @/lib/utils
```

### 1.3 Install Required Shadcn Components
```bash
# Install commonly used components
npx shadcn-ui@latest add button
npx shadcn-ui@latest add input
npx shadcn-ui@latest add label
npx shadcn-ui@latest add card
npx shadcn-ui@latest add dialog
npx shadcn-ui@latest add table
npx shadcn-ui@latest add select
npx shadcn-ui@latest add form
npx shadcn-ui@latest add dropdown-menu
npx shadcn-ui@latest add checkbox
npx shadcn-ui@latest add calendar
npx shadcn-ui@latest add popover
npx shadcn-ui@latest add toast
npx shadcn-ui@latest add separator
npx shadcn-ui@latest add sheet
```

### 1.4 Install Additional Dependencies
```bash
# State Management
npm install zustand

# Form Handling
npm install react-hook-form @hookform/resolvers zod

# Date Handling
npm install date-fns

# Supabase Client
npm install @supabase/supabase-js @supabase/auth-helpers-nextjs

# Icons
npm install lucide-react

# Additional utilities
npm install clsx tailwind-merge
```

---

## Phase 2: Application Structure

### 2.1 Folder Structure (Next.js App Router)
```
smart-spin-erp/
├── src/
│   ├── app/
│   │   ├── layout.js                    # Root layout with sidebar
│   │   ├── page.js                      # Dashboard home
│   │   ├── masters/
│   │   │   ├── department/
│   │   │   │   └── page.js
│   │   │   ├── supervisor/
│   │   │   │   └── page.js
│   │   │   ├── spinning-machine/
│   │   │   │   └── page.js
│   │   │   ├── autocorner-machine/
│   │   │   │   └── page.js
│   │   │   ├── spinning-count/
│   │   │   │   └── page.js
│   │   │   ├── hok-strength/
│   │   │   │   └── page.js
│   │   │   ├── stoppage-head/
│   │   │   │   └── page.js
│   │   │   ├── stoppage-detail/
│   │   │   │   └── page.js
│   │   │   ├── tpi-entry/
│   │   │   │   └── page.js
│   │   │   └── twc-entry/
│   │   │       └── page.js
│   │   └── api/                         # API Routes
│   │       └── masters/
│   │           ├── departments/
│   │           ├── supervisors/
│   │           └── ...
│   ├── components/
│   │   ├── common/
│   │   │   ├── Sidebar.jsx
│   │   │   ├── Header.jsx
│   │   │   ├── DataGrid.jsx
│   │   │   ├── SearchFilter.jsx
│   │   │   └── Modal.jsx
│   │   └── modules/
│   │       └── masters/
│   │           ├── DepartmentForm.jsx
│   │           ├── SupervisorForm.jsx
│   │           └── ...
│   ├── lib/
│   │   ├── supabase.js                  # Supabase client
│   │   └── utils.js
│   ├── hooks/
│   │   ├── useSupabase.js
│   │   └── useMasterData.js
│   └── styles/
│       └── globals.css
├── public/
└── .env.local                            # Supabase credentials
```

### 2.2 Supabase Configuration
Create `.env.local` file:
```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

Create `src/lib/supabase.js`:
```javascript
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
```

---

## Phase 3: Master Modules Implementation

### Module 1: Department Master

**✅ Status: IMPLEMENTED & UPDATED (November 20, 2025)**

#### Screen 1 - Department List View
**Route:** `/masters/department`

**Features:**
- Data grid displaying departments with 31 records (0-31)
- Search functionality with filters (Department, SL.NO, Code)
- Add new department button
- Edit/Delete actions (via toolbar buttons)
- **Right-click context menu** - Click any row to open edit modal directly
- Inline editing support

**Grid Columns:**
| Column | Type | Width | Order |
|--------|------|-------|-------|
| SL.NO | Number | 100px | 1st |
| Code | Number | 100px | 2nd |
| Department | Text | Auto | 3rd |

**Notes:**
- HOK field exists in database but is NOT displayed in the grid
- HOK is maintained for reference and used in other modules
- Serial Number (SL.NO) is displayed as the first column
- Right-click on any cell opens the edit modal for that department

**Complete Department Data (31 records):**
```javascript
const departments = [
  { code: 0, sl_no: 0, department: "none" },
  { code: 1, sl_no: 1, department: "BLOW ROOM" },
  { code: 2, sl_no: 2, department: "CARDING" },
  { code: 3, sl_no: 3, department: "BREAKER DRAWING" },
  { code: 4, sl_no: 4, department: "LAP FORMER" },
  { code: 5, sl_no: 5, department: "COMBER" },
  { code: 6, sl_no: 6, department: "Finisher Drawing" },
  { code: 7, sl_no: 7, department: "SIMPLEX" },
  { code: 8, sl_no: 8, department: "SPINNING" },
  { code: 9, sl_no: 9, department: "SPINNING DOFFER" },
  { code: 10, sl_no: 10, department: "REELIVER" },
  { code: 11, sl_no: 11, department: "AUTOCONER" },
  { code: 12, sl_no: 12, department: "PACKING" },
  { code: 13, sl_no: 13, department: "ELECTRICIAN" },
  { code: 14, sl_no: 14, department: "FITTER" },
  { code: 15, sl_no: 15, department: "FITTER HELPER" },
  { code: 16, sl_no: 16, department: "CLEANING" },
  { code: 17, sl_no: 17, department: "SEMI CLEANING" },
  { code: 18, sl_no: 18, department: "MIXING" },
  { code: 19, sl_no: 19, department: "OHTC" },
  { code: 20, sl_no: 20, department: "COMPRESSOR" },
  { code: 21, sl_no: 21, department: "WCS" },
  { code: 22, sl_no: 22, department: "HF PLANTS" },
  { code: 24, sl_no: 24, department: "ULTIMO" },
  { code: 25, sl_no: 25, department: "POWER DISTRIBUTION" },
  { code: 26, sl_no: 26, department: "SPARE" },
  { code: 27, sl_no: 27, department: "SUESSEN EXHAUST" },
  { code: 28, sl_no: 28, department: "R.O PLANT (FOG)" },
  { code: 29, sl_no: 29, department: "R.O PLANT (HOSTEL)" },
  { code: 30, sl_no: 30, department: "STP PLANT" },
  { code: 31, sl_no: 31, department: "STP RO (PLANT)" }
];
```

**Search Filter Component:**
- Search Field: Dropdown (Department, SL.NO, Code)
- Condition: Dropdown (Like, Equal, Not Equal, Greater, Less)
- Value: Text Input
- Buttons: Search, Show All

#### Screen 2 - Department Detail Card (Modal)
**Title:** "Department Master"
**Subtitle:** "To Add, Modify, Department details."

**Form Fields:**
| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| Code | Number | Yes | Manual | Unique department code (read-only when editing) |
| SL.NO | Number | Yes | Manual | Serial number for sorting |
| Department | Text | Yes | - | Department name (full width) |
| H.O.K | Decimal | Yes | 0.2 | HOK parameter value (hidden from grid but stored) |

**Buttons:**
- Update (Primary) / Save (when creating new)
- Cancel (Secondary)

**Validation Rules:**
- Code: Auto-generated, read-only
- Department: Required, max 100 characters
- SL.NO: Required, unique
- H.O.K: Decimal with 1 decimal place

**API Endpoints (Next.js API Routes):**
```
GET    /api/masters/departments          - List all
GET    /api/masters/departments/[id]     - Get by ID
POST   /api/masters/departments          - Create
PUT    /api/masters/departments/[id]     - Update
DELETE /api/masters/departments/[id]     - Delete
```

**Supabase Query Example:**
```javascript
// Fetch all departments
const { data, error } = await supabase
  .from('departments')
  .select('*')
  .order('code', { ascending: true })

// Create department
const { data, error } = await supabase
  .from('departments')
  .insert([{ department, sl_no, hok }])

// Update department
const { data, error } = await supabase
  .from('departments')
  .update({ department, sl_no, hok })
  .eq('code', id)
```

---

## Phase 4: Common Components

### 4.1 Sidebar Navigation
**Menu Structure:**
```
Masters
├── Department ✓ (Implemented)
├── Mixing
├── Spinning Machine ✓ (Implemented)
├── Autocorner
├── Stoppage Head ✓ (Implemented)
├── Stoppage Detail ✓ (Implemented)
├── Spinning Count ✓ (Implemented)
├── Product Master
├── Waste Master
├── Blend Master
├── HOKStrength ✓ (Implemented)
├── Doubling Count Master
├── Supervisor ✓ (Implemented)
├── Employee Master
├── Autocorner Machine ✓ (Implemented)
├── TPI Entry ✓ (Implemented)
├── TWC Entry ✓ (Implemented)
├── HOK
├── MetalMaster
├── Generator Master
├── Vehicle Master
├── Doff Length
├── Production
├── Preparatory Entry
└── Pre Preparatory

Preparatory Master
├── Carding Machine        (Analyzing)
├── Drawing Breaker Machine
├── Comber Machine
├── Drawing Finisher Machine
├── Simplex Machine
├── Manual Winding Machine
├── Lap Former Machine
├── RibbonLab Machine
├── SliverLab Machine
└── Blow Room Machine

Preparatory Entry
├── Carding Entry ✓ (Module 16)
├── Breaker Drawing Entry ✓ (Module 17)
├── Lap Former Entry ✓ (Module 18)
├── Finisher Drawing Entry ✓ (Module 19)
├── Comber Entry ✓ (Module 20)
└── Simplex Entry ✓ (Module 21)

Post Preparatory
└── Spinning (ACL/Ring Frame) ✓ (Module 22)

Reports
```

### 4.2 Search Filter Component (Reusable - Shadcn)
```jsx
// src/components/common/SearchFilter.jsx
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Search } from "lucide-react"

export function SearchFilter({ fields, conditions, onSearch, onShowAll }) {
  const [searchField, setSearchField] = useState(fields[0])
  const [condition, setCondition] = useState('Like')
  const [value, setValue] = useState('')

  return (
    <div className="flex gap-2 p-4 bg-muted/30 rounded-lg">
      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium">Search Field</label>
        <Select value={searchField} onValueChange={setSearchField}>
          <SelectTrigger className="w-[180px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {fields.map(field => (
              <SelectItem key={field} value={field}>{field}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      
      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium">Condition</label>
        <Select value={condition} onValueChange={setCondition}>
          <SelectTrigger className="w-[120px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {conditions.map(cond => (
              <SelectItem key={cond} value={cond}>{cond}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      
      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium">Value</label>
        <Input 
          value={value} 
          onChange={(e) => setValue(e.target.value)}
          className="w-[200px]"
        />
      </div>
      
      <div className="flex gap-2 items-end">
        <Button onClick={() => onSearch(searchField, condition, value)}>
          <Search className="w-4 h-4 mr-2" />
          Search
        </Button>
        <Button variant="outline" onClick={onShowAll}>
          Show All
        </Button>
      </div>
    </div>
  )
}
```

### 4.3 Data Grid Component (Shadcn Table)
```jsx
// src/components/common/DataGrid.jsx
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"

export function DataGrid({ columns, data, onRowClick, selectedRow }) {
  return (
    <div className="border rounded-lg overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="bg-gradient-to-r from-orange-400 to-orange-500 hover:from-orange-400 hover:to-orange-500">
            {columns.map((col) => (
              <TableHead key={col.key} className="text-white font-bold">
                {col.label}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.map((row, index) => (
            <TableRow
              key={row.id || index}
              onClick={() => onRowClick(row)}
              className={`cursor-pointer ${
                selectedRow?.id === row.id 
                  ? 'bg-sky-300 hover:bg-sky-400' 
                  : 'hover:bg-muted/50'
              }`}
            >
              {columns.map((col) => (
                <TableCell key={col.key} className="text-xs">
                  {row[col.key]}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
```

### 4.4 Modal Component (Shadcn Dialog)
```jsx
// src/components/common/FormModal.jsx
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"

export function FormModal({ 
  open, 
  onOpenChange, 
  title, 
  description, 
  children,
  onSave,
  onCancel 
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-blue-100 border-2 border-primary max-w-2xl">
        <DialogHeader>
          <DialogTitle className="text-lg font-bold">{title}</DialogTitle>
          <DialogDescription className="text-sm">
            {description}
          </DialogDescription>
        </DialogHeader>
        
        <div className="py-4">
          {children}
        </div>
        
        <DialogFooter>
          <Button 
            variant="outline" 
            onClick={onCancel}
          >
            Cancel
          </Button>
          <Button 
            onClick={onSave}
            className="bg-primary hover:bg-primary/90"
          >
            Update
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
```

---

## Phase 5: Styling & Theme (Tailwind CSS + Shadcn UI)

### 5.1 Tailwind Configuration
Update `tailwind.config.js`:
```javascript
/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ["class"],
  content: [
    './pages/**/*.{js,jsx}',
    './components/**/*.{js,jsx}',
    './app/**/*.{js,jsx}',
    './src/**/*.{js,jsx}',
  ],
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      keyframes: {
        "accordion-down": {
          from: { height: 0 },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: 0 },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
}
```

### 5.2 Global CSS Variables
Update `src/app/globals.css`:
```css
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  :root {
    --background: 0 0% 100%;
    --foreground: 20 14.3% 4.1%;
    --card: 0 0% 100%;
    --card-foreground: 20 14.3% 4.1%;
    --popover: 0 0% 100%;
    --popover-foreground: 20 14.3% 4.1%;
    --primary: 24.6 95% 53.1%; /* Orange theme */
    --primary-foreground: 60 9.1% 97.8%;
    --secondary: 60 4.8% 95.9%;
    --secondary-foreground: 24 9.8% 10%;
    --muted: 60 4.8% 95.9%;
    --muted-foreground: 25 5.3% 44.7%;
    --accent: 60 4.8% 95.9%;
    --accent-foreground: 24 9.8% 10%;
    --destructive: 0 84.2% 60.2%;
    --destructive-foreground: 60 9.1% 97.8%;
    --border: 20 5.9% 90%;
    --input: 20 5.9% 90%;
    --ring: 24.6 95% 53.1%; /* Orange ring */
    --radius: 0.5rem;
  }

  .dark {
    --background: 20 14.3% 4.1%;
    --foreground: 60 9.1% 97.8%;
    --card: 20 14.3% 4.1%;
    --card-foreground: 60 9.1% 97.8%;
    --popover: 20 14.3% 4.1%;
    --popover-foreground: 60 9.1% 97.8%;
    --primary: 20.5 90.2% 48.2%;
    --primary-foreground: 60 9.1% 97.8%;
    --secondary: 12 6.5% 15.1%;
    --secondary-foreground: 60 9.1% 97.8%;
    --muted: 12 6.5% 15.1%;
    --muted-foreground: 24 5.4% 63.9%;
    --accent: 12 6.5% 15.1%;
    --accent-foreground: 60 9.1% 97.8%;
    --destructive: 0 72.2% 50.6%;
    --destructive-foreground: 60 9.1% 97.8%;
    --border: 12 6.5% 15.1%;
    --input: 12 6.5% 15.1%;
    --ring: 20.5 90.2% 48.2%;
  }
}

@layer base {
  * {
    @apply border-border;
  }
  body {
    @apply bg-background text-foreground;
  }
}

/* Custom scrollbar */
@layer utilities {
  .scrollbar-thin::-webkit-scrollbar {
    width: 8px;
    height: 8px;
  }
  
  .scrollbar-thin::-webkit-scrollbar-track {
    @apply bg-muted;
  }
  
  .scrollbar-thin::-webkit-scrollbar-thumb {
    @apply bg-primary/50 rounded-md;
  }
  
  .scrollbar-thin::-webkit-scrollbar-thumb:hover {
    @apply bg-primary;
  }
}
```

### 5.3 Color Scheme (Matching Original Design)
**Primary Colors:**
- Primary: Orange (`#FF8C69` / `hsl(24.6 95% 53.1%)`)
- Primary Hover: `#FF6347`
- Selected Row: Light Blue (`#87CEEB`)
- Modal/Card Background: Light Blue (`#D6EAF8`)

**Tailwind Classes:**
```javascript
// Common utility classes
const styles = {
  // Buttons
  primaryButton: "bg-primary hover:bg-primary/90 text-white",
  secondaryButton: "bg-secondary hover:bg-secondary/80",
  
  // Cards
  card: "bg-card border border-border rounded-lg shadow-sm",
  modalCard: "bg-blue-100 border-2 border-primary",
  
  // Table rows
  tableRowSelected: "bg-sky-300 hover:bg-sky-400",
  tableRowHover: "hover:bg-muted/50",
  
  // Headers
  pageHeader: "bg-gradient-to-r from-orange-400 to-orange-500 text-white",
}
```

### 5.4 Typography
- Font Family: System fonts (via Tailwind default)
- Header: `text-sm font-bold`
- Body: `text-xs`
- Labels: `text-sm font-medium`

### 5.5 Component Examples with Shadcn

**Button Component:**
```jsx
import { Button } from "@/components/ui/button"

<Button className="bg-primary hover:bg-primary/90">
  Save
</Button>
<Button variant="outline">Cancel</Button>
```

**Dialog/Modal Component:**
```jsx
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"

<Dialog open={open} onOpenChange={setOpen}>
  <DialogContent className="bg-blue-100 border-2 border-primary">
    <DialogHeader>
      <DialogTitle>Department Master</DialogTitle>
      <DialogDescription>
        To Add, Modify, Department details.
      </DialogDescription>
    </DialogHeader>
    {/* Form content */}
  </DialogContent>
</Dialog>
```

**Table Component:**
```jsx
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

<Table>
  <TableHeader>
    <TableRow>
      <TableHead>Code</TableHead>
      <TableHead>Department</TableHead>
    </TableRow>
  </TableHeader>
  <TableBody>
    {departments.map((dept) => (
      <TableRow 
        key={dept.code}
        className="hover:bg-sky-300 cursor-pointer"
      >
        <TableCell>{dept.code}</TableCell>
        <TableCell>{dept.department}</TableCell>
      </TableRow>
    ))}
  </TableBody>
</Table>
```

**Form Component:**
```jsx
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"

const formSchema = z.object({
  department: z.string().min(1, "Department is required"),
  sl_no: z.number(),
  hok: z.number(),
})

function DepartmentForm() {
  const form = useForm({
    resolver: zodResolver(formSchema),
  })

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)}>
        <FormField
          control={form.control}
          name="department"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Department</FormLabel>
              <FormControl>
                <Input {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type="submit" className="bg-primary">Update</Button>
      </form>
    </Form>
  )
}
```

---

## Phase 6: Development Milestones

### Sprint 1 (Week 1-2)
- [ ] Next.js project setup with App Router
- [ ] Supabase project setup and configuration
- [ ] Database schema creation (see Phase 10)
- [ ] Basic layout with Sidebar and Header
- [ ] Common components (DataGrid, SearchFilter, Modal)
- [ ] Department Master (Complete)

### Sprint 2 (Week 3-4)
- [ ] Spinning Machine Master
- [ ] Stoppage Head Master
- [ ] Spinning Count Master
- [ ] Supabase authentication setup
- [ ] API routes for masters

### Sprint 3 (Week 5-6)
- [ ] HOKStrength Master
- [ ] Supervisor Master
- [ ] Autocorner Machine Master
- [ ] TPI Entry Master
- [ ] TWC Entry Master

### Sprint 4 (Week 7-8)
- [ ] Remaining Master Modules
- [ ] Production Entry Modules
- [ ] Reports Module

### Sprint 5 (Week 9-10)
- [ ] Testing and bug fixes
- [ ] Performance optimization
- [ ] Deployment to Vercel

---

---

## Module 2: Spinning Machine Master

**✅ Status: IMPLEMENTED & UPDATED (November 20, 2025)**

#### Screen 1 - Spinning Machine List View
**Route:** `/masters/spinning-machine`

**Features:**
- Data grid displaying spinning machines (Ring Frame machines)
- Search functionality with filters (Machine No, Description, Make Name)
- Add new machine button
- Multi-select with checkboxes
- Bulk delete functionality
- Right-click context menu for inline editing
- Single and bulk delete actions

**Grid Columns:**
| Column | Type | Width | Order |
|--------|------|-------|-------|
| Machine No | Text | 150px | 1st |
| Description | Text | 200px | 2nd |
| Make Name | Text | Auto | 3rd |

**Notes:**
- Additional fields (Frame No, M/c ID, Model, Spindles, Group No, Installed Date, Checkboxes, Remarks) exist in database and form but NOT displayed in grid
- These fields are maintained for detailed machine information
- Right-click on any row opens the edit modal with full machine details

**Complete Machine Data (33 machines):**
```javascript
const spinningMachines = [
  { machine_no: "17", description: "RF17", make_name: "LMW", mc_id: "225", spindles: 1104, group_no: 0, installed_date: "2015-04-01", is_active: true, production_kgs_manual_entry: false, direct_hank_entry: true },
  { machine_no: "18", description: "RF18", make_name: "LMW", mc_id: "225", spindles: 1104, group_no: 0, installed_date: "2015-04-01", is_active: true, production_kgs_manual_entry: false, direct_hank_entry: true },
  { machine_no: "19", description: "RF19", make_name: "LMW", mc_id: "225", spindles: 1104, group_no: 0, installed_date: "2015-04-01", is_active: true, production_kgs_manual_entry: false, direct_hank_entry: true },
  { machine_no: "20", description: "RF20", make_name: "LMW", mc_id: "225", spindles: 1104, group_no: 0, installed_date: "2015-04-01", is_active: true, production_kgs_manual_entry: false, direct_hank_entry: true },
  { machine_no: "21", description: "RF21", make_name: "LMW", mc_id: "225", spindles: 1104, group_no: 0, installed_date: "2015-04-01", is_active: true, production_kgs_manual_entry: false, direct_hank_entry: true },
  { machine_no: "22", description: "RF22", make_name: "LMW", mc_id: "225", spindles: 1104, group_no: 0, installed_date: "2015-04-01", is_active: true, production_kgs_manual_entry: false, direct_hank_entry: true },
  { machine_no: "23", description: "RF23", make_name: "LMW", mc_id: "225", spindles: 1104, group_no: 0, installed_date: "2015-04-01", is_active: true, production_kgs_manual_entry: false, direct_hank_entry: true },
  { machine_no: "24", description: "RF24", make_name: "LMW", mc_id: "225", spindles: 1104, group_no: 0, installed_date: "2015-04-01", is_active: true, production_kgs_manual_entry: false, direct_hank_entry: true },
  { machine_no: "25", description: "RF25", make_name: "LMW", mc_id: "225", spindles: 1104, group_no: 0, installed_date: "2015-04-01", is_active: true, production_kgs_manual_entry: false, direct_hank_entry: true },
  { machine_no: "26", description: "RF26", make_name: "LMW", mc_id: "225", spindles: 1104, group_no: 0, installed_date: "2015-04-01", is_active: true, production_kgs_manual_entry: false, direct_hank_entry: true },
  { machine_no: "27", description: "RF27", make_name: "LMW", mc_id: "225", spindles: 1104, group_no: 0, installed_date: "2015-04-01", is_active: true, production_kgs_manual_entry: false, direct_hank_entry: true },
  { machine_no: "28", description: "RF28", make_name: "LMW", mc_id: "225", spindles: 1104, group_no: 0, installed_date: "2015-04-01", is_active: true, production_kgs_manual_entry: false, direct_hank_entry: true },
  { machine_no: "29", description: "RF29", make_name: "LMW", mc_id: "225", spindles: 1104, group_no: 0, installed_date: "2015-04-01", is_active: true, production_kgs_manual_entry: false, direct_hank_entry: true },
  { machine_no: "30", description: "RF30", make_name: "LMW", mc_id: "225", spindles: 1104, group_no: 0, installed_date: "2015-04-01", is_active: true, production_kgs_manual_entry: false, direct_hank_entry: true },
  { machine_no: "31", description: "RF31", make_name: "LMW", mc_id: "225", spindles: 1104, group_no: 0, installed_date: "2015-04-01", is_active: true, production_kgs_manual_entry: false, direct_hank_entry: true },
  { machine_no: "32", description: "RF32", make_name: "LMW", mc_id: "225", spindles: 1104, group_no: 0, installed_date: "2015-04-01", is_active: true, production_kgs_manual_entry: false, direct_hank_entry: true },
  { machine_no: "33", description: "RF33", make_name: "LMW", mc_id: "225", spindles: 1104, group_no: 0, installed_date: "2015-04-01", is_active: true, production_kgs_manual_entry: false, direct_hank_entry: true },
  { machine_no: "34", description: "RF34", make_name: "LMW", mc_id: "225", spindles: 1104, group_no: 0, installed_date: "2015-04-01", is_active: true, production_kgs_manual_entry: false, direct_hank_entry: true },
  { machine_no: "35", description: "RF35", make_name: "LMW", mc_id: "225", spindles: 1104, group_no: 0, installed_date: "2015-04-01", is_active: true, production_kgs_manual_entry: false, direct_hank_entry: true },
  { machine_no: "36", description: "RF36", make_name: "LMW", mc_id: "225", spindles: 1104, group_no: 0, installed_date: "2015-04-01", is_active: true, production_kgs_manual_entry: false, direct_hank_entry: true },
  { machine_no: "37", description: "RF37", make_name: "LMW", mc_id: "225", spindles: 1104, group_no: 0, installed_date: "2015-04-01", is_active: true, production_kgs_manual_entry: false, direct_hank_entry: true },
  { machine_no: "38", description: "RF38", make_name: "LMW", mc_id: "225", spindles: 1104, group_no: 0, installed_date: "2015-04-01", is_active: true, production_kgs_manual_entry: false, direct_hank_entry: true },
  { machine_no: "39", description: "RF39", make_name: "LMW", mc_id: "225", spindles: 1104, group_no: 0, installed_date: "2015-04-01", is_active: true, production_kgs_manual_entry: false, direct_hank_entry: true },
  { machine_no: "40", description: "RF40", make_name: "LMW", mc_id: "225", spindles: 1104, group_no: 0, installed_date: "2015-04-01", is_active: true, production_kgs_manual_entry: false, direct_hank_entry: true },
  { machine_no: "41", description: "RF41", make_name: "LMW", mc_id: "225", spindles: 1104, group_no: 0, installed_date: "2015-04-01", is_active: true, production_kgs_manual_entry: false, direct_hank_entry: true },
  { machine_no: "42", description: "RF42", make_name: "LMW", mc_id: "225", spindles: 1104, group_no: 0, installed_date: "2015-04-01", is_active: true, production_kgs_manual_entry: false, direct_hank_entry: true },
  { machine_no: "43", description: "RF43", make_name: "LMW", mc_id: "225", spindles: 1104, group_no: 0, installed_date: "2015-04-01", is_active: true, production_kgs_manual_entry: false, direct_hank_entry: true },
  { machine_no: "44", description: "RF44", make_name: "LMW", mc_id: "225", spindles: 1104, group_no: 0, installed_date: "2015-04-01", is_active: true, production_kgs_manual_entry: false, direct_hank_entry: true },
  { machine_no: "45", description: "RF45", make_name: "LMW", mc_id: "225", spindles: 1104, group_no: 0, installed_date: "2015-04-01", is_active: true, production_kgs_manual_entry: false, direct_hank_entry: true },
  { machine_no: "46", description: "RF46", make_name: "LMW", mc_id: "225", spindles: 1104, group_no: 0, installed_date: "2015-04-01", is_active: true, production_kgs_manual_entry: false, direct_hank_entry: true },
  { machine_no: "47", description: "RF47", make_name: "LMW", mc_id: "225", spindles: 1104, group_no: 0, installed_date: "2015-04-01", is_active: true, production_kgs_manual_entry: false, direct_hank_entry: true },
  { machine_no: "1A", description: "RF1A", make_name: "LMW", mc_id: "225", spindles: 1104, group_no: 0, installed_date: "2015-04-01", is_active: true, production_kgs_manual_entry: false, direct_hank_entry: true },
  { machine_no: "2A", description: "RF2A", make_name: "LMW", mc_id: "225", spindles: 1104, group_no: 0, installed_date: "2015-04-01", is_active: true, production_kgs_manual_entry: false, direct_hank_entry: true }
];
```

**Search Filter Component:**
- Search Field: Dropdown (Machine No, Description, Make Name)
- Condition: Dropdown (Like, Equal, Not Equal, Greater, Less)
- Value: Text Input
- Buttons: Search, Show All

#### Screen 2 - Spinning Machine Detail Card (Modal)
**Title:** "Spinning Machine Master"
**Subtitle:** "Modify machine details" / "Add new machine"

**Form Fields:**
| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| Frame No. | Number | No | Auto | Machine frame number (read-only when editing) |
| M/c ID | Text | Yes | 225 | Machine identifier |
| Description | Text | Yes | - | Machine description (e.g., "RF39") - Full width |
| Make Name | Text | Yes | LMW | Manufacturer name |
| Model | Text | No | - | Machine model |
| No. of Spindles | Number | Yes | 1104 | Spindle count |
| Group No | Number | Yes | 0 | Machine group identifier |
| Installed Date | Date | Yes | 2015-04-01 | Installation date - Full width |
| Active | Checkbox | Yes | Checked | Machine active status |
| Production Kgs Manual Entry | Checkbox | No | Unchecked | Manual production entry flag |
| Direct Hank Entry | Checkbox | No | Checked | Direct hank entry flag - Full width |
| Remarks | Textarea | No | - | Additional notes - Full width |

**Buttons:**
- Update (Primary - Blue) / Create (when adding new)
- Cancel (Secondary)
- Delete (Red - Left side, only when editing)

**Validation Rules:**
- Frame No.: Auto-generated, read-only when editing
- M/c ID: Required, default 225
- Description: Required, max 50 characters
- Make Name: Required, default LMW
- Group No: Required, numeric
- Installed Date: Required, date picker
- Checkboxes: Boolean flags

**API Endpoints:**
```
GET    /api/masters/spinning-machines          - List all
GET    /api/masters/spinning-machines/[id]     - Get by ID
POST   /api/masters/spinning-machines          - Create
PUT    /api/masters/spinning-machines/[id]     - Update
DELETE /api/masters/spinning-machines/[id]     - Delete
```

---

## Module 3: Stoppage Head Master

**✅ Status: IMPLEMENTED & UPDATED (November 20, 2025)**

#### Screen 1 - Stoppage Head List View
**Route:** `/masters/stoppage-head`

**Features:**
- Data grid displaying stoppage categories
- Search functionality with filters (Code, Stoppage Head Name)
- Add new stoppage head button
- Multi-select with checkboxes
- Bulk delete functionality
- Right-click context menu for inline editing
- Single and bulk delete actions

**Grid Columns:**
| Column | Type | Width | Order |
|--------|------|-------|-------|
| Code | Number | 100px | 1st |
| Stoppage Head Name | Text | Auto | 2nd |

**Notes:**
- Description field exists in database and form but NOT displayed in grid
- Code is auto-generated for new entries (starts from 11)
- Codes 1-10 are predefined as per plan.md data
- Right-click on any row opens the edit modal

**Complete Stoppage Head Data (10 records):**
```javascript
const stoppageHeads = [
  { code: 1, stoppage_head_name: "CLEANING WORK", description: null },
  { code: 2, stoppage_head_name: "ELECT. BREAKDOWN", description: null },
  { code: 3, stoppage_head_name: "ELECT. ROUTINE", description: null },
  { code: 4, stoppage_head_name: "MAINTEN. BREAKDOWN", description: null },
  { code: 5, stoppage_head_name: "MAINTEN. ROUTINE", description: null },
  { code: 6, stoppage_head_name: "POWER. SHOUTDOWN", description: null },
  { code: 7, stoppage_head_name: "POWER FAILURE", description: null },
  { code: 8, stoppage_head_name: "OTHERS", description: null },
  { code: 9, stoppage_head_name: "ERECTION WORK", description: null },
  { code: 10, stoppage_head_name: "QAO", description: null }
];
```

**Search Filter Component:**
- Search Field: Dropdown (Code, Stoppage Head Name)
- Condition: Dropdown (Like, Equal, Not Equal, Greater, Less)
- Value: Text Input
- Buttons: Search, Show All

#### Screen 2 - Stoppage Head Detail Card (Modal)
**Title:** "Stoppage Head Master"
**Subtitle:** "Modify stoppage head details" / "Add new stoppage head"

**Form Fields:**
| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| Code | Number | No | Auto | Auto-increment (read-only when editing) |
| Stoppage Head Master | Text | Yes | - | Stoppage category name - Full width |
| Description | Text | No | - | Additional description/notes - Full width |

**Buttons:**
- Update (Primary - Blue) / Create (when adding new)
- Cancel (Secondary)
- Delete (Red - Left side, only when editing)

**Validation Rules:**
- Code: Auto-generated, read-only when editing
- Stoppage Head Master: Required, max 100 characters, unique
- Description: Optional, max 255 characters

**API Endpoints:**
```
GET    /api/masters/stoppage-heads          - List all
GET    /api/masters/stoppage-heads/[id]     - Get by ID
POST   /api/masters/stoppage-heads          - Create
PUT    /api/masters/stoppage-heads/[id]     - Update
DELETE /api/masters/stoppage-heads/[id]     - Delete
```

**Notes:**
- This module manages main stoppage categories
- Used as parent categories for detailed stoppage reasons
- Related to Stoppage Detail module (one-to-many relationship)
- Critical for production downtime analysis

---

## Module 4: Stoppage Detail Master

**✅ Status: COMPLETED** (November 20, 2025)
- Module fully implemented with Department-style pattern
- Query functions with proper JOIN syntax and data formatting
- Form component with 7 fields and validation
- Page component with multi-select, bulk delete, right-click editing
- Schema defined with foreign keys to stoppage_heads and departments
- 33 predefined records (codes 1447-1479)
- Auto-increment sequence starting from 1480

#### Screen 1 - Stoppage Detail List View
**Route:** `/masters/stoppage-detail`

**Features:**
- Data grid displaying detailed stoppage reasons
- Search functionality with filters (Code, Stoppage Name, Stoppage Head Name, Department)
- Add new stoppage detail button
- Multi-select with checkboxes
- Bulk delete functionality
- Right-click context menu for inline editing
- Single and bulk delete actions

**Grid Columns:**
| Column | Type | Width | Order |
|--------|------|-------|-------|
| Code | Number | 100px | 1st |
| Stoppage Name | Text | 200px | 2nd |
| Stoppage Head Name | Text | 200px | 3rd |
| Department | Text | Auto | 4th |

**Notes:**
- Additional fields (Description, Short Code, Full Stoppage Name) exist in form but NOT in grid
- Code is auto-generated for new entries (starts from 1480)
- Codes 1447-1479 are predefined as per VB6 application
- Right-click on any row opens the edit modal
- Each stoppage detail belongs to one Stoppage Head (foreign key)
- Each stoppage detail belongs to one Department (foreign key)

**Search Filter Component:**
- Search Field: Dropdown (Code, Stoppage Name, Stoppage Head Name, Department)
- Condition: Dropdown (Like, Equal, Not Equal, Greater, Less)
- Value: Text Input
- Buttons: Search, Show All

#### Screen 2 - Stoppage Detail Form (Modal)
**Title:** "Stoppage Detail Master"
**Subtitle:** "To Modify the Stoppage Details" / "Add new stoppage detail"

**Form Fields:**
| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| Code | Number | No | Auto | Auto-increment (read-only when editing) |
| Stoppage Name | Text | Yes | - | Short stoppage reason - Full width |
| Description | Text | No | - | Detailed description - Full width |
| Short Code | Text | No | - | Abbreviated code (2-4 chars) |
| Department | Dropdown | Yes | - | Select from departments |
| Stoppage Head | Dropdown | Yes | - | Select from stoppage heads |
| Full Stoppage Name | Text | No | - | Complete stoppage description |

**Buttons:**
- Save (Primary - Blue) / Create (when adding new)
- Cancel (Secondary)
- Delete (Red - Left side, only when editing)

**Validation Rules:**
- Code: Auto-generated, read-only when editing
- Stoppage Name: Required, max 100 characters
- Description: Optional, max 255 characters
- Short Code: Optional, max 10 characters
- Department: Required, must exist in departments table
- Stoppage Head: Required, must exist in stoppage_heads table
- Full Stoppage Name: Optional, max 200 characters
- Combination of (stoppage_head_id, code) must be unique

**API Endpoints:**
```
GET    /api/masters/stoppage-details          - List all with joins
GET    /api/masters/stoppage-details/[id]     - Get by ID
POST   /api/masters/stoppage-details          - Create
PUT    /api/masters/stoppage-details/[id]     - Update
DELETE /api/masters/stoppage-details/[id]     - Delete
```

**Sample Stoppage Detail Data (33 records from VB6 application):**
```javascript
const stoppageDetails = [
  { code: 1447, stoppage_name: "LAZY WORK", stoppage_head: "ELECT. BREAKDOWN", department: "CARDING", short_code: "LW", description: "Employee lazy work" },
  { code: 1448, stoppage_name: "SUSSON GEAR BOX PROBLEM", stoppage_head: "MAINTEN. BREAKDOWN", department: "SPINNING", short_code: "SGP", description: "Susson gear box malfunction" },
  { code: 1449, stoppage_name: "ABC RING CHANGE", stoppage_head: "MAINTEN. ROUTINE", department: "SPINNING", short_code: "ARC", description: "Ring replacement" },
  { code: 1450, stoppage_name: "FRONT ROLL PROBLEM", stoppage_head: "MAINTEN. BREAKDOWN", department: "SPINNING", short_code: "FRP", description: "Front roll issue" },
  { code: 1451, stoppage_name: "DOFFING LIMIT PROBLEM", stoppage_head: "MAINTEN. BREAKDOWN", department: "SPINNING", short_code: "DLP", description: "Doffing limit sensor issue" },
  { code: 1452, stoppage_name: "BOTTOM ROLL PROBLEM", stoppage_head: "MAINTEN. BREAKDOWN", department: "SPINNING", short_code: "BRP", description: "Bottom roll malfunction" },
  { code: 1453, stoppage_name: "TPU TRIP", stoppage_head: "ELECT. BREAKDOWN", department: "SPINNING", short_code: "TT", description: "TPU tripped" },
  { code: 1454, stoppage_name: "ACB TRIP", stoppage_head: "ELECT. BREAKDOWN", department: "AUTOCONER", short_code: "AT", description: "ACB circuit breaker trip" },
  { code: 1455, stoppage_name: "ROLL STAND PROBLEM", stoppage_head: "MAINTEN. BREAKDOWN", department: "SPINNING", short_code: "RSP", description: "Roll stand issue" },
  { code: 1456, stoppage_name: "DRAFTING ROLLER SERVICE", stoppage_head: "MAINTEN. ROUTINE", department: "Finisher Drawing", short_code: "DRS", description: "Drafting roller maintenance" },
  { code: 1457, stoppage_name: "CONVERTOR PROBLEM", stoppage_head: "ELECT. BREAKDOWN", department: "AUTOCONER", short_code: "CP", description: "Convertor failure" },
  { code: 1458, stoppage_name: "FLYER SERVICE", stoppage_head: "MAINTEN. BREAKDOWN", department: "SIMPLEX", short_code: "FS", description: "Flyer maintenance" },
  { code: 1459, stoppage_name: "RING RAIL HANDLE PROBLEM", stoppage_head: "MAINTEN. BREAKDOWN", department: "SPINNING", short_code: "RHP", description: "Ring rail handle issue" },
  { code: 1460, stoppage_name: "TOP ARM PRESSURE LOCK PROBLEM", stoppage_head: "MAINTEN. BREAKDOWN", department: "Finisher Drawing", short_code: "TAP", description: "Top arm pressure lock" },
  { code: 1461, stoppage_name: "DRAFTING ARM NOSE PROBLEM", stoppage_head: "MAINTEN. BREAKDOWN", department: "SPINNING", short_code: "DNP", description: "Drafting arm nose issue" },
  { code: 1462, stoppage_name: "SSB CABLE PROBLEM", stoppage_head: "ELECT. BREAKDOWN", department: "SPINNING", short_code: "SCP", description: "SSB cable fault" },
  { code: 1463, stoppage_name: "SUCTION PROBLEM", stoppage_head: "ELECT. BREAKDOWN", department: "BREAKER DRAWING", short_code: "SP", description: "Suction system failure" },
  { code: 1464, stoppage_name: "INVERTOR PROGRAME WORK", stoppage_head: "ELECT. BREAKDOWN", department: "SPINNING", short_code: "IPW", description: "Invertor programming" },
  { code: 1465, stoppage_name: "FIVE LEVEL SETTING", stoppage_head: "MAINTEN. BREAKDOWN", department: "CARDING", short_code: "FLS", description: "Five level adjustment" },
  { code: 1466, stoppage_name: "INDY PROBLEM", stoppage_head: "MAINTEN. ROUTINE", department: "SIMPLEX", short_code: "IP", description: "Individual spindle issue" },
  { code: 1467, stoppage_name: "BEARING CHANGE", stoppage_head: "MAINTEN. BREAKDOWN", department: "COMBER", short_code: "BC", description: "Bearing replacement" },
  { code: 1468, stoppage_name: "DISMANDLING", stoppage_head: "OTHERS", department: "SPINNING", short_code: "DM", description: "Machine dismantling" },
  { code: 1469, stoppage_name: "PISTON SOFT WORK", stoppage_head: "MAINTEN. BREAKDOWN", department: "LAP FORMER", short_code: "PSW", description: "Piston soft work" },
  { code: 1470, stoppage_name: "DRAFTING SERVICES", stoppage_head: "MAINTEN. ROUTINE", department: "SIMPLEX", short_code: "DS", description: "Drafting service" },
  { code: 1471, stoppage_name: "GEAR BOX PROBLEM", stoppage_head: "MAINTEN. BREAKDOWN", department: "SPINNING", short_code: "GBP", description: "Gear box malfunction" },
  { code: 1472, stoppage_name: "SUCTION PRESSURE PROBLEM", stoppage_head: "MAINTEN. BREAKDOWN", department: "CARDING", short_code: "SPP", description: "Suction pressure issue" },
  { code: 1473, stoppage_name: "CIVIL WORK", stoppage_head: "OTHERS", department: "SPINNING", short_code: "CW", description: "Civil construction work" },
  { code: 1474, stoppage_name: "DRAFTING SETTING WORK", stoppage_head: "MAINTEN. BREAKDOWN", department: "LAP FORMER", short_code: "DSW", description: "Drafting setting" },
  { code: 1475, stoppage_name: "CRADLE CLEANING WORK", stoppage_head: "MAINTEN. ROUTINE", department: "SPINNING", short_code: "CCW", description: "Cradle cleaning" },
  { code: 1476, stoppage_name: "DEAD BOX WORK", stoppage_head: "MAINTEN. BREAKDOWN", department: "CARDING", short_code: "DBW", description: "Dead box maintenance" },
  { code: 1477, stoppage_name: "EMPTIES MOVEMENT/CYLINDERS SENSOR PROBLEM", stoppage_head: "ELECT. BREAKDOWN", department: "SPINNING", short_code: "EMP", description: "Empty movement sensor" },
  { code: 1478, stoppage_name: "EMPTIES MOVEMENT PROBLEM", stoppage_head: "MAINTEN. BREAKDOWN", department: "AUTOCONER", short_code: "EMP2", description: "Empties movement issue" },
  { code: 1479, stoppage_name: "LINE LOOKING PROBLEM", stoppage_head: "MAINTEN. BREAKDOWN", department: "SPINNING", short_code: "LLP", description: "Line locking problem" }
];
```

**Relationships:**
- **stoppage_head_id** (Foreign Key): Links to stoppage_heads table
- **department_id** (Foreign Key): Links to departments table
- One Stoppage Head can have many Stoppage Details (1:N)
- One Department can have many Stoppage Details (1:N)
- Used in production stoppage tracking and downtime analysis

**Notes:**
- This module provides detailed breakdown of stoppage reasons
- Each detail is categorized under a Stoppage Head
- Department association helps analyze department-specific issues
- Short codes used for quick data entry
- Critical for production analysis and efficiency tracking
- Code sequence continues from 1480 for new entries

---

## Module 5: Spinning Count Master

**✅ Status: COMPLETED** (November 20, 2025)
- Module fully implemented with Department-style pattern
- Query functions with proper field names matching schema
- Form component with 22 fields in 2-column layout
- Page component with multi-select, bulk delete, right-click editing
- Schema defined with all 22 fields + UUID primary key
- 21 predefined records (sample data)
- Grid displays only 2 columns: Count Name and Act Count
- Responsive design for mobile, tablet, and desktop

**Features Implemented:**
- Multi-select with checkboxes for bulk operations
- Bulk delete functionality with count display
- Right-click on row to edit (opens modal)
- Single delete from modal
- Search functionality (Count Name, Act Count)
- Form validation with React Hook Form + Zod
- Two checkboxes: "Is running now" and "Autoconer Active"
- All 22 fields properly mapped to database schema

#### Screen 1 - Spinning Count List View
**Route:** `/masters/spinning-count`

**Features:**
- Data grid displaying yarn count specifications
- Search functionality with filters
- Add new count button
- Edit/Delete actions

**Grid Columns:**
| Column | Type | Width |
|--------|------|-------|
| Count Name | Text | 300px |
| Act Count | Decimal | 150px |

**Sample Data:**
```javascript
const spinningCounts = [
  { countName: "60 COMBED GOLD", actCount: "60.5" },
  { countName: "61 COMBED SPECIAL", actCount: "66" },
  { countName: "62 COMBED COMPACT", actCount: "62" },
  { countName: "63 COM GOLD", actCount: "64.5" },
  { countName: "66 COMBED GOLD", actCount: "68.5" },
  { countName: "66 COMBED STAR", actCount: "68.5" },
  { countName: "64 COMBED", actCount: "66" },
  { countName: "60COME STAR", actCount: "60.5" },
  { countName: "60COM COMPACT", actCount: "60.5" },
  { countName: "65 COMBED STAR", actCount: "68.5" },
  { countName: "60CCT", actCount: "60.5" },
  { countName: "65COMBED GOLD", actCount: "68.5" },
  { countName: "60cs STAR", actCount: "60.5" },
  { countName: "6 COMPACT STAR", actCount: "66" },
  { countName: "6 COMBED COMPACT", actCount: "61.8" },
  { countName: "68 COMBED STAR", actCount: "69.5" },
  { countName: "6 COMBED DIAMOND", actCount: "61.8" },
  { countName: "92 COMBED WARP", actCount: "93" },
  { countName: "80 COMBED COMPACT WARP", actCount: "80.5" },
  { countName: "91 COMBED WARP", actCount: "91" },
  { countName: "80 COMBED WARP", actCount: "80.5" }
];
```

**Search Filter Component:**
- Search Field: Dropdown (Count Name)
- Condition: Dropdown (Like)
- Value: Text Input
- Buttons: Search, Show All

#### Screen 2 - Spinning Count Detail Card (Modal)
**Title:** "Spinning Count"
**Subtitle:** "Spinning Count Master : To Modify the Spinning Count Details"

**Form Fields - Left Column:**
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| Count Name | Text | Yes | Yarn count description |
| Short Desc | Text | No | Short description |
| Act Count | Decimal | Yes | Actual count value |
| Mixing Name | Text | No | Related mixing recipe |
| Fibre | Text | No | Fiber type |
| 40S.Comv.Value | Decimal | No | 40s conversion value |
| U.K.G | Decimal | No | U.K.G parameter |
| Effr. for Exp. Hank | Decimal | No | Efficiency for export hank |
| Effr. for Exp. Prodn. | Decimal | No | Efficiency for export production |
| Is running now | Checkbox | No | Currently running flag |
| Autoconer Active | Checkbox | No | Autoconer active status |

**Form Fields - Right Column:**
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| Skra.Comv.Value | Decimal | No | Skra conversion value |
| Cone Weight | Decimal | No | Cone weight |
| Effr. for Actual Prodn. | Decimal | No | Efficiency for actual production |
| TPI | Text | No | Twists per inch |
| Speed | Text | No | Machine speed |
| Speed [Auto coner] | Decimal | No | Autoconer speed |
| TW.CON | Text | No | TW conversion |
| Waste % | Decimal | No | Waste percentage |
| Doff Loss | Decimal | No | Doffing loss |
| Auto.Effi | Decimal | No | Auto efficiency |
| H.O.K Cons. | Decimal | No | HOK consumption |

**Buttons:**
- Save (Primary)
- Cancel (Secondary)

**Validation Rules:**
- Count Name: Required, max 100 characters, unique
- Act Count: Required, decimal (2 decimal places)
- Short Desc: Optional, max 50 characters
- All decimal fields: Format with 1-2 decimal places
- Checkboxes: Boolean flags

**API Endpoints:**
```
GET    /api/masters/spinning-counts          - List all
GET    /api/masters/spinning-counts/[id]     - Get by ID
POST   /api/masters/spinning-counts          - Create
PUT    /api/masters/spinning-counts/[id]     - Update
DELETE /api/masters/spinning-counts/[id]     - Delete
```

**Notes:**
- Complex form with 22 fields
- Contains production parameters and efficiency calculations
- Links to Mixing Master
- Critical for production planning and quality control

---

## Module 5: HOKStrength Master

#### Screen 1 - HOKStrength List View
**Route:** `/masters/hok-strength`

**Features:**
- Data grid displaying HOK strength records by date
- Search functionality with filters
- Add new HOK record button
- Edit/Delete actions

**Grid Columns:**
| Column | Type | Width |
|--------|------|-------|
| id | Number | 100px |
| date | Date | 200px |

**Sample Data:**
```javascript
const hokStrengthRecords = [
  { id: 1150, date: "21-Jan-20" },
  { id: 1151, date: "22-Jan-20" },
  { id: 1152, date: "23-Jan-20" },
  { id: 1153, date: "24-Jan-20" },
  { id: 1154, date: "25-Jan-20" },
  { id: 1155, date: "26-Jan-20" },
  { id: 1156, date: "27-Jan-20" },
  { id: 1157, date: "28-Jan-20" },
  { id: 1158, date: "29-Jan-20" },
  { id: 1159, date: "30-Jan-20" },
  { id: 1160, date: "31-Jan-20" },
  { id: 1161, date: "01-Feb-20" },
  { id: 1162, date: "02-Feb-20" },
  { id: 1163, date: "03-Feb-20" },
  { id: 1164, date: "04-Feb-20" },
  { id: 1165, date: "05-Feb-20" },
  { id: 1166, date: "06-Feb-20" },
  { id: 1167, date: "07-Feb-20" },
  { id: 1168, date: "08-Feb-20" },
  { id: 1169, date: "09-Feb-20" },
  { id: 1170, date: "14-Feb-20" },
  { id: 1171, date: "15-Feb-20" },
  { id: 1172, date: "16-Feb-20" },
  { id: 1173, date: "17-Feb-20" },
  { id: 1174, date: "21-Jan-21" },
  { id: 1175, date: "20-Jan-21" },
  { id: 1176, date: "22-Sep-22" },
  { id: 1177, date: "23-Jul-23" },
  { id: 1178, date: "18-Jul-24" },
  { id: 1179, date: "03-May-24" },
  { id: 1180, date: "03-Aug-24" },
  { id: 1181, date: "01-Aug-24" },
  { id: 1182, date: "05-Aug-24" }
];
```

**Search Filter Component:**
- Search Field: Dropdown (id)
- Condition: Dropdown (=)
- Value: Text Input
- Buttons: Search, Show All

#### Screen 2 - HOKStrength Detail Card (Modal)
**Title:** "HOKStrengthHead"
**Subtitle:** "HOK Strength Head : To Modify the HOK Strength Heed"

**Form Fields:**
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| HokID | Number | Yes | Auto-increment ID (e.g., 1183) |
| Date | Date | Yes | Test date with date picker |

**Department-wise HOK Data Grid:**
Multi-row data grid with columns:
| Column | Type | Description |
|--------|------|-------------|
| Dept | Text | Department name (readonly, from master) |
| Shift1 | Decimal | Shift 1 HOK value |
| Shift2 | Decimal | Shift 2 HOK value |
| Shift3 | Decimal | Shift 3 HOK value |

**Sample Departments in Grid:**
```javascript
const hokDepartments = [
  { dept: "MIXING", shift1: "", shift2: "", shift3: "" },
  { dept: "BLOW ROOM", shift1: "", shift2: "", shift3: "" },
  { dept: "CARDING", shift1: "", shift2: "", shift3: "" },
  { dept: "DRAWING", shift1: "", shift2: "", shift3: "" },
  { dept: "SIMPLEX SIDER", shift1: "", shift2: "", shift3: "" },
  { dept: "SIMPLEX DOFFER", shift1: "", shift2: "", shift3: "" },
  { dept: "SPG SIDER", shift1: "", shift2: "", shift3: "" },
  { dept: "SPG DOFFER", shift1: "", shift2: "", shift3: "" },
  { dept: "MAISTRY", shift1: "", shift2: "", shift3: "" },
  { dept: "CLEANING", shift1: "", shift2: "", shift3: "" }
];
```

**Total Row:** Displays sum of all shift values

**Buttons:**
- Save (Primary)
- cancel (Secondary)

**Validation Rules:**
- HokID: Auto-generated, read-only
- Date: Required, cannot be future date
- Shift values: Optional, decimal (1 decimal place), >= 0

**API Endpoints:**
```
GET    /api/masters/hok-strength              - List all
GET    /api/masters/hok-strength/[id]         - Get by ID with details
POST   /api/masters/hok-strength              - Create with department data
PUT    /api/masters/hok-strength/[id]         - Update
DELETE /api/masters/hok-strength/[id]         - Delete
```

**Notes:**
- Header-Detail structure (one-to-many)
- Date-based quality tracking system
- Department-wise shift tracking
- Used for production quality monitoring
- Grid allows bulk data entry for all departments
- Sample data includes 33 historical records (IDs 1150-1182)
- Each header has 10 detail records (one per department)

**Database Schema:**
```sql
-- Header Table
CREATE TABLE hok_strength_head (
  hok_id INTEGER PRIMARY KEY,
  date DATE NOT NULL UNIQUE,
  total_shift1 DECIMAL(10,2) DEFAULT 0,
  total_shift2 DECIMAL(10,2) DEFAULT 0,
  total_shift3 DECIMAL(10,2) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Detail Table
CREATE TABLE hok_strength_detail (
  id SERIAL PRIMARY KEY,
  hok_id INTEGER NOT NULL,
  department_id UUID NOT NULL,
  shift1 DECIMAL(10,1) DEFAULT 0,
  shift2 DECIMAL(10,1) DEFAULT 0,
  shift3 DECIMAL(10,1) DEFAULT 0,
  FOREIGN KEY (hok_id) REFERENCES hok_strength_head(hok_id) ON DELETE CASCADE,
  FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE CASCADE,
  UNIQUE(hok_id, department_id)
);
```
- Header-Detail structure (one-to-many)
- Date-based quality tracking system
- Department-wise shift tracking
- Used for production quality monitoring
- Grid allows bulk data entry for all departments

---

## Module 6: Supervisor Master

#### Screen 1 - Supervisor List View
**Route:** `/masters/supervisor`

**Features:**
- Data grid displaying supervisors
- Search functionality with filters
- Add new supervisor button
- Edit/Delete actions

**Grid Columns:**
| Column | Type | Width |
|--------|------|-------|
| Code | Number | 100px |
| Name | Text | 250px |
| Department | Text | 200px |

**Sample Data:**
```javascript
const supervisors = [
  { code: 9, name: "nil", department: "SPINNING" },
  { code: 3, name: "CHINNADURA.R", department: "SPINNING" },
  { code: 4, name: "SUBRAMANIAN.A", department: "SPINNING" },
  { code: 5, name: "A.NAMBRI RAJ", department: "SPINNING" },
  { code: 6, name: "SAKARAKUMAR.G", department: "SPINNING" },
  { code: 7, name: "BALASUBRAMANIAN", department: "SPINNING" },
  { code: 8, name: "SASIKUMAR", department: "SPINNING" },
  { code: 10, name: "THANGARA.J.P", department: "SPINNING" },
  { code: 11, name: "KALINITH.M.K", department: "SPINNING" },
  { code: 12, name: "PRAKASH Y", department: "SPINNING" },
  { code: 14, name: "A.G.T HARIHARAN", department: "SPINNING" }
];
```

**Search Filter Component:**
- Search Field: Dropdown (Code)
- Condition: Dropdown (=)
- Value: Text Input
- Buttons: Search, Show All

#### Screen 2 - Supervisor Detail Card (Modal)
**Title:** "Supervisor"
**Subtitle:** "Supervisor Master : To Add, Modify Supervisor details."

**Form Fields:**
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| Code | Number | Yes | Auto-increment supervisor ID |
| Name | Text | Yes | Supervisor full name |
| Department | Dropdown | Yes | Department assignment |

**Buttons:**
- Save (Primary)
- Cancel (Secondary)

**Validation Rules:**
- Code: Auto-generated, read-only
- Name: Required, max 100 characters, unique
- Department: Required, dropdown from Department Master

**API Endpoints:**
```
GET    /api/masters/supervisors              - List all
GET    /api/masters/supervisors/[id]         - Get by ID
POST   /api/masters/supervisors              - Create
PUT    /api/masters/supervisors/[id]         - Update
DELETE /api/masters/supervisors/[id]         - Delete
```

**Relationships:**
- Links to Department Master (foreign key)
- Used in production entries for shift supervision tracking
- Referenced in employee assignments

**Notes:**
- Simple 3-field master
- Most supervisors assigned to SPINNING department
- Foreign key relationship with Department table
- Essential for production tracking and accountability

---

## Module 7: Autocorner Machine Master

#### Screen 1 - Autocorner Machine List View
**Route:** `/masters/autocorner-machine`

**Features:**
- Data grid displaying autoconer machines
- Search functionality with filters
- Add new machine button
- Edit/Delete actions

**Grid Columns:**
| Column | Type | Width |
|--------|------|-------|
| M/c No. | Text | 150px |
| Description | Text | 200px |
| Make Name | Text | 200px |
| ActEffi | Number | 100px |

**Sample Data (35 records from VB6 application - as per actual order):**
```javascript
const autocornerMachines = [
  // AC4 Series
  { mcNo: "AC4-5", description: "AC4-5", makeName: "MURT", actEffi: 0 },
  // AC5 Series (80% efficiency)
  { mcNo: "AC5-1", description: "AC5-1", makeName: "MURT", actEffi: 80 },
  { mcNo: "AC5-2", description: "AC5-2", makeName: "MURT", actEffi: 80 },
  { mcNo: "AC5-3", description: "AC5-3", makeName: "MURT", actEffi: 80 },
  { mcNo: "AC5-4", description: "AC5-4", makeName: "MURT", actEffi: 80 },
  { mcNo: "AC5-5", description: "AC5-5", makeName: "MURT", actEffi: 80 },
  // AC6 Series
  { mcNo: "AC6-1", description: "AC6-1", makeName: "MURT", actEffi: 82 },
  { mcNo: "AC6-2", description: "AC6-2", makeName: "MURT", actEffi: 0 },
  { mcNo: "AC6-3", description: "AC6-3", makeName: "MURT", actEffi: 0 },
  { mcNo: "AC6-4", description: "AC6-4", makeName: "MURT", actEffi: 0 },
  { mcNo: "AC6-5", description: "AC6-5", makeName: "MURT", actEffi: 0 },
  // AC7 Series
  { mcNo: "AC7-1", description: "AC7-1", makeName: "MURT", actEffi: 0 },
  { mcNo: "AC7-2", description: "AC7-2", makeName: "MURT", actEffi: 0 },
  { mcNo: "AC7-3", description: "AC7-3", makeName: "MURT", actEffi: 0 },
  { mcNo: "AC7-4", description: "AC7-4", makeName: "MURT", actEffi: 0 },
  { mcNo: "AC7-5", description: "AC7-5", makeName: "MURT", actEffi: 0 },
  // AC8 Series
  { mcNo: "AC8-1", description: "AC8-1", makeName: "MURT", actEffi: 0 },
  { mcNo: "AC8-2", description: "AC8-2", makeName: "MURT", actEffi: 0 },
  { mcNo: "AC8-3", description: "AC8-3", makeName: "MURT", actEffi: 0 },
  { mcNo: "AC8-4", description: "AC8-4", makeName: "MURT", actEffi: 0 },
  { mcNo: "AC8-5", description: "AC8-5", makeName: "MURT", actEffi: 0 },
  // AC9 Series
  { mcNo: "AC9-1", description: "AC9-1", makeName: "MURT", actEffi: 0 },
  { mcNo: "AC9-2", description: "AC9-2", makeName: "MURT", actEffi: 0 },
  // AC10 Series
  { mcNo: "AC10-1", description: "AC10-1", makeName: "MURT", actEffi: 0 },
  { mcNo: "AC10-2", description: "AC10-2", makeName: "MURT", actEffi: 0 },
  // AC11 Series
  { mcNo: "AC11-1", description: "AC11-1", makeName: "MURT", actEffi: 0 },
  { mcNo: "AC11-2", description: "AC11-2", makeName: "MURT", actEffi: 0 },
  // AC12 Series (82% efficiency for AC12-1)
  { mcNo: "AC12-1", description: "AC12-1", makeName: "MURT", actEffi: 82 },
  { mcNo: "AC12-2", description: "AC12-2", makeName: "MURT", actEffi: 0 },
  // AC13 Series (82% efficiency)
  { mcNo: "AC13-1", description: "AC13-1", makeName: "MURT", actEffi: 82 },
  { mcNo: "AC13-2", description: "AC13-2", makeName: "MURT", actEffi: 82 },
  // AC14 Series
  { mcNo: "AC14-1", description: "AC14-1", makeName: "MURT", actEffi: 0 },
  // AC2A Series (Additional machines)
  { mcNo: "AC2A-1", description: "AC2A-1", makeName: "MURT", actEffi: 0 },
  { mcNo: "AC2A-2", description: "AC2A-2", makeName: "MURT", actEffi: 0 }
];
```

**Machine Count Summary:**
| Series | Count | Efficiency Status |
|--------|-------|-------------------|
| AC4 | 1 | Inactive (0%) |
| AC5 | 5 | Active (80%) |
| AC6 | 5 | Mixed (AC6-1: 82%, rest: 0%) |
| AC7 | 5 | Inactive (0%) |
| AC8 | 5 | Inactive (0%) |
| AC9 | 2 | Inactive (0%) |
| AC10 | 2 | Inactive (0%) |
| AC11 | 2 | Inactive (0%) |
| AC12 | 2 | Mixed (AC12-1: 82%, AC12-2: 0%) |
| AC13 | 2 | Active (82%) |
| AC14 | 1 | Inactive (0%) |
| AC2A | 2 | Inactive (0%) |
| **Total** | **35** | **Active: 11, Inactive: 24** |

**Search Filter Component:**
- Search Field: Dropdown (Description)
- Condition: Dropdown (Like)
- Value: Text Input
- Buttons: Search, Show All

#### Screen 2 - Autocorner Machine Detail Card (Modal)
**Title:** "AutoConer Machine Master"
**Subtitle:** "Machine Make Screen : To Add, Modify Machine Make Details"

**Form Fields:**
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| Mc id | Number (Auto) | Yes | Serial number (1, 2, 3...) - Auto-generated for new machines |
| Group Id | Dropdown | Yes | Machine group (2=AC2A, 4=AC4, 5=AC5, 6=AC6, etc.) |
| M/c No. | Text | Yes | Machine number (e.g., "AC5-1") |
| Description | Text | Yes | Machine description |
| Make Name | Text | Yes | Manufacturer name (e.g., "MURT") |
| Model | Text | No | Machine model |
| From Drum | Number | No | Drum range start |
| To Drum | Number | No | Drum range end |
| No. of Drums | Number | Yes | Total drums count |
| Speed | Number | No | Machine speed |
| Count | Text | No | Yarn count |
| Act Effi | Number | No | Actual efficiency % |
| Installed Date | Date | Yes | Installation date (e.g., "05-May-25") |
| Active | Checkbox | Yes | Machine active status |
| Direct Prod Entry | Checkbox | Yes | Yes/No production entry mode |

**Database Schema:**
| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| mc_id | INTEGER | Serial number (1-34) - auto-incremented |
| group_id | INTEGER | Machine group (2, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14) |
| machine_no | TEXT | Machine number (unique) |
| description | TEXT | Machine description |
| make_name | TEXT | Manufacturer (default: MURT) |
| model | TEXT | Machine model |
| from_drum | INTEGER | Drum range start |
| to_drum | INTEGER | Drum range end |
| no_of_drums | INTEGER | Total drums count |
| speed | INTEGER | Machine speed |
| count | TEXT | Yarn count reference |
| act_effi | INTEGER | Actual efficiency % |
| installed_date | DATE | Installation date |
| is_active | BOOLEAN | Active status |
| direct_prod_entry | BOOLEAN | Direct production entry flag |

**Buttons:**
- Save (Primary)
- Cancel (Secondary)

**Validation Rules:**
- Mc id: Required, dropdown selection
- Group Id: Required, dropdown selection
- M/c No.: Required, max 20 characters
- Description: Required, max 50 characters
- Make Name: Required, max 50 characters
- No. of Drums: Required, numeric, > 0
- Act Effi: Optional, numeric, 0-100
- Installed Date: Required, date picker
- Active: Boolean checkbox
- Direct Prod Entry: Radio button (Yes/No)

**API Endpoints:**
```
GET    /api/masters/autocorner-machines          - List all
GET    /api/masters/autocorner-machines/[id]     - Get by ID
POST   /api/masters/autocorner-machines          - Create
PUT    /api/masters/autocorner-machines/[id]     - Update
DELETE /api/masters/autocorner-machines/[id]     - Delete
```

**Notes:**
- All machines are MURT make (Muratec manufacturer)
- Machine numbering follows AC[group]-[number] pattern (e.g., AC5-1, AC12-2)
- AC2A series uses alphanumeric group identifier
- Total 35 machines registered in the system
- 11 machines are active (efficiency > 0): AC5 series (80%), AC6-1, AC12-1, AC13-1, AC13-2 (82%)
- 24 machines are inactive or new (efficiency = 0)
- Drum-based winding machines (Auto Coner)
- Related to yarn winding/packaging process
- Used in production entries for autoconer department

---

## Module 8: TPI Entry Master

**✅ Status: FULLY IMPLEMENTED (December 1, 2025)**

### Implementation Summary
- **Route:** `/masters/tpi-entry`
- **Files Created:**
  - `src/app/masters/tpi-entry/page.jsx` - Main list view with Department pattern
  - `src/components/modules/masters/TPIEntryForm.jsx` - Form component
  - `src/lib/supabase/tpiEntryQueries.js` - CRUD operations
  - `schema/tpi-twc-data-fix.sql` - Data migration fix script

### Features Implemented (Department Pattern)
- ✅ Data grid displaying TPI entries with count name join
- ✅ Search functionality (ID, Entry Date, TPI Value)
- ✅ Add new TPI entry button
- ✅ **Select mode** for bulk delete (matches Department)
- ✅ **Context menu** - Right-click to edit (matches Department)
- ✅ **Delete in modal** when editing (matches Department)
- ✅ **isLoading state** during operations (matches Department)
- ✅ **Responsive header** for mobile (matches Department)
- ✅ View-based query with column mapping (tpi → tpi_value)

#### Screen 1 - TPI Entry List View
**Route:** `/masters/tpi-entry`

**Features:**
- Data grid displaying TPI (Twists Per Inch) entries
- Search functionality with filters (id, =)
- Add new TPI entry button
- Edit/Delete actions via row click
- Right-click context menu for inline editing

**Grid Columns:**
| Column | DB Field | Type | Width | Description |
|--------|----------|------|-------|-------------|
| id | entry_id | Number | 100px | Sequential ID (33, 34, 35...) |
| sdate | entry_date | Date | 150px | Date in DD-Mon-YY format |
| countname | spinning_count_id (joined) | Text | 250px | Yarn count name from spinning_counts |
| TPI | tpi_value | Decimal | 100px | Twists Per Inch value |

**Sample Data:**
```javascript
const tpiEntries = [
  { id: 33, iddate: "02-Jan-18", countname: "6 COMPACT STAR", tpi: 29.35 },
  { id: 34, iddate: "04-Feb-18", countname: "66 COMBED STAR", tpi: 30.81 },
  { id: 35, iddate: "08-Feb-18", countname: "60COM COMPACT", tpi: 33.95 },
  { id: 36, iddate: "23-Feb-18", countname: "60COM COMPACT", tpi: 33.13 },
  { id: 37, iddate: "18-Jun-18", countname: "66 COMBED STAR", tpi: 31.56 },
  { id: 38, iddate: "18-Jun-18", countname: "60COME STAR", tpi: 27.96 },
  { id: 39, iddate: "10-Jul-18", countname: "60COME STAR", tpi: 27.29 },
  { id: 40, iddate: "10-Jul-18", countname: "66 COMBED STAR", tpi: 30.81 },
  { id: 41, iddate: "28-Aug-18", countname: "6 COMPACT STAR", tpi: 28.6 },
  { id: 42, iddate: "02-Sep-18", countname: "6 COMPACT STAR", tpi: 29.35 },
  { id: 43, iddate: "17-Mar-19", countname: "68 COMBED STAR", tpi: 31.56 },
  { id: 44, iddate: "05-Apr-19", countname: "66 COMBED STAR", tpi: 31.56 },
  { id: 45, iddate: "16-Apr-19", countname: "6 COMBED COMPACT", tpi: 33.95 },
  { id: 46, iddate: "12-Jun-19", countname: "60COME STAR", tpi: 27.96 },
  { id: 47, iddate: "29-Jun-19", countname: "6 COMPACT STAR", tpi: 30.07 },
  { id: 48, iddate: "25-Oct-19", countname: "60COME STAR", tpi: 27.29 },
  { id: 49, iddate: "14-Nov-19", countname: "6 COMBED COMPACT", tpi: 33.13 },
  { id: 50, iddate: "05-Dec-19", countname: "66 COMBED STAR", tpi: 30.81 },
  { id: 51, iddate: "06-Dec-19", countname: "60COME STAR", tpi: 27.96 },
  { id: 52, iddate: "13-Jan-20", countname: "6 COMPACT STAR", tpi: 29.35 },
  { id: 53, iddate: "27-Aug-21", countname: "6 COMBED COMPACT", tpi: 33.95 },
  { id: 54, iddate: "21-Sep-21", countname: "68 COMBED STAR", tpi: 4 },
  { id: 55, iddate: "20-Sep-21", countname: "68 COMBED STAR", tpi: 31.56 },
  { id: 56, iddate: "18-Feb-22", countname: "68 COMBED STAR", tpi: 32.34 },
  { id: 57, iddate: "30-Jul-22", countname: "91 COMBED WARP", tpi: 39.35 },
  { id: 58, iddate: "24-Nov-22", countname: "68 COMBED STAR", tpi: 33.13 },
  { id: 59, iddate: "30-Dec-22", countname: "6 COMBED COMPACT", tpi: 33.13 },
  { id: 60, iddate: "06-Jan-23", countname: "68 COMBED STAR", tpi: 31.57 },
  { id: 61, iddate: "29-Jan-24", countname: "68 COMBED STAR", tpi: 32.34 },
  { id: 62, iddate: "23-Feb-24", countname: "6 COMBED DIAMOND", tpi: 32.34 },
  { id: 63, iddate: "13-Dec-24", countname: "68 COMBED STAR", tpi: 33.13 },
  { id: 64, iddate: "4-Dec-24", countname: "68 COMBED STAR", tpi: 5 },
  { id: 65, iddate: "13-Dec-24", countname: "68 COMBED STAR", tpi: 33.13 }
];
```

**Search Filter Component:**
- Search Field: Dropdown (id)
- Condition: Dropdown (=)
- Value: Text Input
- Buttons: Search, Show All

#### Screen 2 - TPI Entry Detail Card (Modal)
**Title:** "TPI Modification"
**Subtitle:** "Despatch : To Add, Modify daily TPI details."

**Form Fields:**
| Field | DB Field | Type | Required | Description |
|-------|----------|------|----------|-------------|
| Date | entry_date | Date picker | Yes | TPI test date (e.g., "05-May-25") |
| Count | spinning_count_id | Dropdown | Yes | Yarn count from Spinning Count Master |
| TPI | tpi_value | Decimal | Yes | Twists Per Inch value (e.g., 33.13) |

**Hidden/Optional Fields (exist in DB but not in VB6 form):**
| Field | DB Field | Type | Required | Description |
|-------|----------|------|----------|-------------|
| Machine | machine_id | Dropdown | No | Spinning machine (optional) |
| Shift | shift | Dropdown (A/B/C) | No | Production shift |
| Remarks | remarks | Text | No | Additional notes |

**Buttons:**
- Save (Primary)
- Cancel (Secondary)

**Validation Rules:**
- Date: Required, date picker
- Count: Required, dropdown from Spinning Count Master
- TPI: Required, decimal (2 decimal places), > 0

**Database Schema:**
| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| entry_id | SERIAL | Sequential display ID (33, 34, 35...) |
| entry_date | DATE | Test date |
| spinning_count_id | UUID | FK to spinning_counts |
| tpi_value | DECIMAL(10,2) | TPI value |
| machine_id | UUID | FK to spinning_machines (optional) |
| shift | TEXT | A, B, or C (optional) |
| remarks | TEXT | Notes (optional) |

**API Endpoints:**
```
GET    /api/masters/tpi-entries              - List all (with count_name join)
GET    /api/masters/tpi-entries/[id]         - Get by ID
POST   /api/masters/tpi-entries              - Create
PUT    /api/masters/tpi-entries/[id]         - Update
DELETE /api/masters/tpi-entries/[id]         - Delete
```

**Supabase Query (Grid Display):**
```javascript
const { data, error } = await supabase
  .from('tpi_entries')
  .select(`
    id,
    entry_id,
    entry_date,
    tpi_value,
    spinning_count_id,
    spinning_counts (
      id,
      count_name
    )
  `)
  .order('entry_id', { ascending: false });
```

**Relationships:**
- Foreign key to Spinning Count Master (spinning_count_id → spinning_counts.id)
- Optional foreign key to Spinning Machine Master (machine_id → spinning_machines.id)
- Used for quality control tracking
- Historical data for TPI trends

**Notes:**
- Simple 3-field entry form (matching VB6)
- Date-based quality parameter tracking
- TPI values typically range from 27-39 for different counts
- Historical data from 2018 onwards (id starts from 33)
- Critical quality control parameter for yarn production
- Extra fields (machine_id, shift, remarks) can be hidden for VB6-like simplicity

**Business Logic:**
- Each count has standard TPI range
- Multiple TPI tests can be recorded per date/count combination
- Used for quality analysis and trend monitoring
- Helps maintain product specifications

---

## Module 9: TWC Entry Master

**✅ Status: FULLY IMPLEMENTED (December 1, 2025)**

### Implementation Summary
- **Route:** `/masters/twc-entry`
- **Files Created:**
  - `src/app/masters/twc-entry/page.jsx` - Main list view with Department pattern
  - `src/components/modules/masters/TWCEntryForm.jsx` - Form component
  - `src/lib/supabase/twcEntryQueries.js` - CRUD operations
  - `schema/tpi-twc-data-fix.sql` - Data migration fix script (shared with TPI)

### Features Implemented (Department Pattern)
- ✅ Data grid displaying TWC entries with count name join
- ✅ Search functionality (ID, Entry Date, TWC Value)
- ✅ Add new TWC entry button
- ✅ **Select mode** for bulk delete (matches Department)
- ✅ **Context menu** - Right-click to edit (matches Department)
- ✅ **Delete in modal** when editing (matches Department)
- ✅ **isLoading state** during operations (matches Department)
- ✅ **Responsive header** for mobile (matches Department)
- ✅ View-based query with column mapping (twc → twc_value)

### Database Schema (supabase-setup.sql)
```sql
CREATE TABLE IF NOT EXISTS twc_entries (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  entry_id SERIAL,  -- Sequential ID for VB6-style display (1, 2, 3...)
  entry_date DATE NOT NULL,
  spinning_count_id UUID REFERENCES spinning_counts(id) ON DELETE CASCADE,
  twc_value DECIMAL(10,2) NOT NULL,
  machine_id UUID REFERENCES spinning_machines(id) ON DELETE SET NULL,
  shift TEXT CHECK (shift IN ('A', 'B', 'C')),
  remarks TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_twc_entries_date ON twc_entries(entry_date);
CREATE INDEX IF NOT EXISTS idx_twc_entries_entry_id ON twc_entries(entry_id);
```

### Key Points
- **entry_id**: SERIAL column for VB6-style sequential display (737, 738, 739...)
- **id**: UUID primary key for Supabase compatibility
- **spinning_count_id**: FK to spinning_counts table (uses count_name for display)

#### Screen 1 - TWC Entry List View
**Route:** `/masters/twc-entry`

**Features:**
- Data grid displaying TWC (Twist Weight Count) entries
- Select mode for bulk delete
- Right-click context menu to edit
- Delete button in modal when editing

**VB6 Grid Columns (mapped to Next.js):**
| VB6 Column | DB Column | Display Format | Notes |
|------------|-----------|----------------|-------|
| id | entry_id | Number | Sequential integer (737, 738...) |
| sdate | entry_date | dd-MMM-yy | Format: "20-May-24" |
| countname | spinning_counts.count_name | Text | Joined from spinning_counts |
| TWC | twc_value | Decimal | Format: "2.50" |

**Search Filter:**
- Field: ID, Entry Date, TWC Value
- Condition: =, Like, Not Equal, Greater, Less
- Value: Input field

**Sample Data:**
```javascript
const twcEntries = [
  { id: 737, iddate: "20-May-24", countname: "68 COMBED STAR", twc: 2.5 },
  { id: 738, iddate: "24-May-24", countname: "68 COMBED STAR", twc: 2 },
  { id: 739, iddate: "27-May-24", countname: "6 COMBED DIAMOND", twc: 2 },
  // ... more entries
];
```

#### Screen 2 - TWC Entry Form (Modal)
**Title:** "TWC Entry Master"
**Subtitle:** "Despatch : To Add, Modify daily TWC details."

**VB6 Form Fields (mapped to Next.js):**
| VB6 Field | DB Column | Type | Required | Notes |
|-----------|-----------|------|----------|-------|
| Date | entry_date | date | Yes | Format: YYYY-MM-DD |
| Count | spinning_count_id | UUID | Yes | Dropdown from spinning_counts.count_name |
| TWC | twc_value | decimal | Yes | Decimal (10,2) |
| - | shift | text | No | Optional: A, B, C (not in VB6) |
| - | remarks | text | No | Optional notes (not in VB6) |

**Buttons:**
- Create/Update (Primary, in FormModal)
- Cancel (Secondary)
- Delete (Danger, shown when editing)

**Validation Rules:**
- Date: Required, date picker, cannot be future date
- Count: Required, dropdown from Spinning Count Master
- TWC: Required, decimal (1 decimal place), >= 0

**API Endpoints:**
```
GET    /api/masters/twc-entries              - List all
GET    /api/masters/twc-entries/[id]         - Get by ID
POST   /api/masters/twc-entries              - Create
PUT    /api/masters/twc-entries/[id]         - Update
DELETE /api/masters/twc-entries/[id]         - Delete
```

**Relationships:**
- Foreign key to Spinning Count Master
- Used for quality control tracking
- Historical data for TWC parameter trends

**Notes:**
- Simple 3-field entry form (identical structure to TPI Entry)
- Date-based quality parameter tracking
- TWC values typically range from 2.0 to 3.5
- Most entries are for "68 COMBED STAR" count
- Historical data from May 2024 onwards
- Critical quality control parameter for yarn production
- Used to verify yarn twist/weight/count specifications
- Links to Spinning Count Master for count selection

**Business Logic:**
- Each count has standard TWC range
- Multiple TWC tests can be recorded per date/count combination
- Used for quality analysis and trend monitoring
- Helps maintain product specifications
- TWC parameter helps control yarn quality consistency

**Comparison with TPI Entry:**
| Feature | TPI Entry | TWC Entry |
|---------|-----------|-----------|
| Structure | Identical | Identical |
| Fields | Date, Count, Value | Date, Count, Value |
| Value Range | 27-39 | 2.0-3.5 |
| Purpose | Twist measurement | Twist/Weight/Count parameter |
| Data History | 2018 onwards | 2024 onwards |

---

## Phase 8: Next Steps

**Completed Analysis:**
1. ✅ Department Master
2. ✅ Spinning Machine Master (Ring Frames)
3. ✅ Stoppage Head Master
4. ✅ Spinning Count Master
5. ✅ HOKStrength Master
6. ✅ Supervisor Master
7. ✅ Autocorner Machine Master
8. ✅ TPI Entry Master
9. ✅ TWC Entry Master

**Pending Analysis:**
10. Mixing Master
11. Stoppage Detail
12. Product Master
13. Waste Master
14. Blend Master
15. Doubling Count Master
16. Employee Master
17. And other modules...

---

## Phase 9: Preparatory Master Modules

### Preparatory Master Menu Structure
```
Preparatory Master
├── Carding Machine           (✅ Analyzed)
├── Drawing Breaker Machine
├── Comber Machine
├── Drawing Finisher Machine
├── Simplex Machine
├── Manual Winding Machine
├── Lap Former Machine
├── RibbonLab Machine
├── SliverLab Machine
└── Blow Room Machine
```

---

## Module 10: Carding Machine Master

**Status: ✅ IMPLEMENTED (December 2, 2025)**

### Implementation Summary
- **Page:** `src/app/preparatory-master/carding-machine/page.jsx`
- **Form:** `src/components/modules/preparatory-master/CardingMachineForm.jsx`
- **Queries:** `src/lib/supabase/cardingMachineQueries.js`
- **Database:** `carding_machines` table in Supabase

### Features Implemented
- ✅ Data grid with McNo, Description, Model, Mixing columns
- ✅ Search filter with McNo, Description, Model fields
- ✅ Add/Edit/Delete operations
- ✅ Select mode with bulk delete
- ✅ Context menu (right-click to edit)
- ✅ Delete button in modal
- ✅ isLoading state for forms
- ✅ Responsive design
- ✅ Following Department module pattern

### Overview
- **Location:** Preparatory Master → Carding Machine
- **Purpose:** Manage carding machine details for production tracking
- **Similar To:** Spinning Machine Master, Autoconer Machine Master

### Screen 1 - Carding Machine List View
**Route:** `/preparatory-master/carding-machine`

**VB6 Grid Columns:**
| Column | DB Field | Type | Width | Description |
|--------|----------|------|-------|-------------|
| McNo | machine_no | Text | 80px | Machine number (CA1, CA2...) |
| Description | description | Text | 150px | Machine description |
| Model | model | Text | 120px | Model name (LC300A, LC300A V3) |
| Mixing | mixing | Text | 100px | Production mixing reference |

**Search Filter:**
- Field: McNo
- Condition: Like
- Value: Text input

**Sample Data (22 records from VB.NET):**
```javascript
const cardingMachines = [
  { mcNo: "CA1", description: "CA1", model: "LC300A", mixing: "-" },
  { mcNo: "CA2", description: "CA2", model: "LC300A", mixing: "-" },
  { mcNo: "CA3", description: "CA3", model: "LC300A", mixing: "-" },
  { mcNo: "CA4", description: "CA4", model: "LC300A", mixing: "-" },
  { mcNo: "CA5", description: "CA5", model: "LC300A", mixing: "-" },
  { mcNo: "CA6", description: "CA6", model: "LC300A", mixing: "-" },
  { mcNo: "CA7", description: "CA7", model: "LC300A", mixing: "-" },
  { mcNo: "CA8", description: "CA8", model: "LC300A V3", mixing: "-" },
  { mcNo: "CA9", description: "CA9", model: "LC300A V3", mixing: "-" },
  { mcNo: "CA10", description: "CA10", model: "LC300A V3", mixing: "-" },
  { mcNo: "CA11", description: "CA11", model: "LC300A", mixing: "-" },
  { mcNo: "CA12", description: "CA12", model: "LC300A", mixing: "-" },
  { mcNo: "CA13", description: "CA13", model: "LC300A", mixing: "-" },
  { mcNo: "CA14", description: "CA14", model: "LC300A V3", mixing: "-" },
  { mcNo: "CA15", description: "CA15", model: "LC300A V3", mixing: "-" },
  { mcNo: "CA16", description: "CA16", model: "LC300A V3", mixing: "-" },
  { mcNo: "CA17", description: "CA17", model: "LC300A V3", mixing: "-" },
  { mcNo: "CA18", description: "CA18", model: "LC300A V3", mixing: "-" },
  { mcNo: "CA19", description: "CA19", model: "LC300A V3", mixing: "-" },
  { mcNo: "CA20", description: "CA20", model: "LC300A V3", mixing: "-" },
  { mcNo: "CA21", description: "CA21", model: "LC300AV3", mixing: "-" },
  { mcNo: "CA22", description: "CA22", model: "LC300AV3", mixing: "-" },
];
```

### Screen 2 - Carding Machine Form (Modal)
**Title:** "Carding Machine Master"
**Subtitle:** "To Add, Modify Machine Make Details"

**VB6 Form Fields:**
| Field | DB Column | Type | Required | Description |
|-------|-----------|------|----------|-------------|
| M\C No. | machine_no | Text | Yes | Machine identifier (CA1, CA2...) |
| M/c ID | mc_id | Integer | Yes | Numeric ID (23, 24...) |
| Description | description | Text | No | Machine description |
| Make Name | make_name | Text | No | Manufacturer name |
| Model | model | Text | No | Model name (LC300A, LC300A V3) |
| ProdnMixing | prodn_mixing | Text | No | Production mixing reference |
| Speed | speed | Integer | No | Machine speed |
| Prodn Effi. | prodn_efficiency | Decimal | No | Production efficiency % |
| Installed Date | installed_date | Date | No | Installation date |
| Active | is_active | Boolean | No | Yes/No checkbox |
| Direct Hank Entry | direct_hank_entry | Boolean | No | Yes/No checkbox |
| Direct Kgs Entry | direct_kgs_entry | Boolean | No | Yes/No checkbox |

**Buttons:**
- Save (Primary)
- Cancel (Secondary)

### Database Schema
```sql
CREATE TABLE IF NOT EXISTS carding_machines (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  machine_no TEXT NOT NULL UNIQUE,
  description TEXT,
  make_name TEXT,
  mc_id INTEGER,
  model TEXT,
  prodn_mixing TEXT,
  speed INTEGER,
  prodn_efficiency DECIMAL(5,2) DEFAULT 0,
  installed_date DATE DEFAULT CURRENT_DATE,
  is_active BOOLEAN DEFAULT true,
  direct_hank_entry BOOLEAN DEFAULT false,
  direct_kgs_entry BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_carding_machines_machine_no ON carding_machines(machine_no);
CREATE INDEX IF NOT EXISTS idx_carding_machines_mc_id ON carding_machines(mc_id);
CREATE INDEX IF NOT EXISTS idx_carding_machines_is_active ON carding_machines(is_active);
```

### Sample Insert Data
```sql
INSERT INTO carding_machines (machine_no, description, model, mc_id, is_active) VALUES
('CA1', 'CA1', 'LC300A', 1, true),
('CA2', 'CA2', 'LC300A', 2, true),
('CA3', 'CA3', 'LC300A', 3, true),
('CA4', 'CA4', 'LC300A', 4, true),
('CA5', 'CA5', 'LC300A', 5, true),
('CA6', 'CA6', 'LC300A', 6, true),
('CA7', 'CA7', 'LC300A', 7, true),
('CA8', 'CA8', 'LC300A V3', 8, true),
('CA9', 'CA9', 'LC300A V3', 9, true),
('CA10', 'CA10', 'LC300A V3', 10, true),
('CA11', 'CA11', 'LC300A', 11, true),
('CA12', 'CA12', 'LC300A', 12, true),
('CA13', 'CA13', 'LC300A', 13, true),
('CA14', 'CA14', 'LC300A V3', 14, true),
('CA15', 'CA15', 'LC300A V3', 15, true),
('CA16', 'CA16', 'LC300A V3', 16, true),
('CA17', 'CA17', 'LC300A V3', 17, true),
('CA18', 'CA18', 'LC300A V3', 18, true),
('CA19', 'CA19', 'LC300A V3', 19, true),
('CA20', 'CA20', 'LC300A V3', 20, true),
('CA21', 'CA21', 'LC300AV3', 21, true),
('CA22', 'CA22', 'LC300AV3', 22, true);
```

### Implementation Notes
- **Similar Pattern To:** Autoconer Machine Master (same field types)
- **Department Link:** References CARDING department
- **Mixing Reference:** May link to a future mixing table
- **Model Types:** LC300A (older), LC300A V3 (newer version)

### API Endpoints (Using Supabase Direct Queries)
```
getCardingMachines()          - List all
getCardingMachineById(id)     - Get by ID
createCardingMachine(data)    - Create
updateCardingMachine(id,data) - Update
deleteCardingMachine(id)      - Delete
searchCardingMachines()       - Search
```

### Files Created ✅
```
src/
├── app/preparatory-master/
│   ├── page.jsx                 ✅ Landing page with module cards
│   └── carding-machine/
│       └── page.jsx             ✅ Main CRUD page
├── components/modules/preparatory-master/
│   └── CardingMachineForm.jsx   ✅ Form component with validation
└── lib/supabase/
    └── cardingMachineQueries.js ✅ CRUD + search queries
```

---

## Module 11: Drawing Breaker Machine Master

**Status: ✅ IMPLEMENTED (December 2, 2025)**

### Implementation Summary
- **Page:** `src/app/preparatory-master/drawing-breaker/page.jsx`
- **Form:** `src/components/modules/preparatory-master/DrawingBreakerForm.jsx`
- **Queries:** `src/lib/supabase/drawingBreakerQueries.js`
- **Database:** `drawing_breaker_machines` table in Supabase

### Features Implemented
- ✅ Data grid with McNo, Mixing Name, Description, Make, Speed columns
- ✅ Search filter with McNo, Description, Make fields
- ✅ Add/Edit/Delete operations
- ✅ Select mode with bulk delete
- ✅ Context menu (right-click to edit)
- ✅ Delete button in modal
- ✅ isLoading state for forms
- ✅ Responsive design
- ✅ Following Department module pattern

### Overview
- **Location:** Preparatory Master → Drawing Breaker Machine
- **Purpose:** Manage drawing breaker (draw frame) machine details
- **Similar To:** Carding Machine Master (IDENTICAL STRUCTURE)

### Screen 1 - Drawing Breaker Machine List View
**Route:** `/preparatory-master/drawing-breaker`

**VB6 Grid Columns:**
| Column | DB Field | Type | Width | Description |
|--------|----------|------|-------|-------------|
| McNo | machine_no | Text | 80px | Machine number (BD1, BD2...) |
| Mixing Name | prodn_mixing | Text | 100px | Production mixing (64) |
| Description | description | Text | 150px | Machine description |
| Make | make_name | Text | 100px | Manufacturer (LMW) |
| Speed | speed | Integer | 80px | Machine speed |

**Search Filter:**
- Field: McNo
- Condition: Like
- Value: Text input

**Sample Data (5 records from VB.NET):**
```javascript
const drawingBreakerMachines = [
  { mcNo: "BD1", mixingName: "64", description: "BD1", make: "LMW", speed: 550 },
  { mcNo: "BD2", mixingName: "64", description: "BD2", make: "LMW", speed: 500 },
  { mcNo: "BD3", mixingName: "64", description: "BD3", make: "LMW", speed: 800 },
  { mcNo: "BD11", mixingName: "64", description: "BD11", make: "LMW", speed: 0 },
  { mcNo: "BD4", mixingName: "64", description: "BD4", make: "LMW", speed: 800 },
];
```

### Screen 2 - Drawing Breaker Machine Form (Modal)
**Title:** "Draw Frame Breaker M/c Master"
**Subtitle:** "To Add, Modify Machine Make Details"

**VB6 Form Fields (IDENTICAL to Carding Machine):**
| Field | DB Column | Type | Required | Description |
|-------|-----------|------|----------|-------------|
| M\C No. | machine_no | Text | Yes | Machine identifier (BD1, BD2...) |
| M/c ID | mc_id | Integer | Yes | Numeric ID (6, 7...) |
| Description | description | Text | No | Machine description |
| Make Name | make_name | Text | No | Manufacturer name (LMW) |
| Model | model | Text | No | Model name |
| ProdnMixing | prodn_mixing | Text | No | Production mixing (64) |
| Speed | speed | Integer | No | Machine speed |
| Prodn Effi. | prodn_efficiency | Decimal | No | Production efficiency % |
| Installed Date | installed_date | Date | No | Installation date |
| Active | is_active | Boolean | No | Yes/No checkbox |
| Direct Hank Entry | direct_hank_entry | Boolean | No | Yes/No checkbox |
| Direct Kgs Entry | direct_kgs_entry | Boolean | No | Yes/No checkbox |

**Buttons:**
- Save (Primary)
- Cancel (Secondary)

### Database Schema
**REUSES carding_machines table structure - create new table: drawing_breaker_machines**
```sql
CREATE TABLE IF NOT EXISTS drawing_breaker_machines (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  machine_no TEXT NOT NULL UNIQUE,
  description TEXT,
  make_name TEXT,
  mc_id INTEGER,
  model TEXT,
  prodn_mixing TEXT,
  speed INTEGER,
  prodn_efficiency DECIMAL(5,2) DEFAULT 0,
  installed_date DATE DEFAULT '2015-04-01',
  is_active BOOLEAN DEFAULT true,
  direct_hank_entry BOOLEAN DEFAULT false,
  direct_kgs_entry BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Sample Insert Data
```sql
INSERT INTO drawing_breaker_machines (machine_no, description, make_name, prodn_mixing, speed, mc_id, is_active) VALUES
('BD1', 'BD1', 'LMW', '64', 550, 1, true),
('BD2', 'BD2', 'LMW', '64', 500, 2, true),
('BD3', 'BD3', 'LMW', '64', 800, 3, true),
('BD4', 'BD4', 'LMW', '64', 800, 4, true),
('BD11', 'BD11', 'LMW', '64', 0, 11, true);
```

### Implementation Notes
- **IDENTICAL Pattern To:** Carding Machine Master
- **Can Reuse:** CardingMachineForm.jsx pattern (copy and rename)
- **Department Link:** References BREAKER DRAWING department
- **Mixing Value:** All machines have "64" as mixing

### Files Created ✅
```
src/
├── app/preparatory-master/
│   └── drawing-breaker/
│       └── page.jsx             ✅ Main CRUD page
├── components/modules/preparatory-master/
│   └── DrawingBreakerForm.jsx   ✅ Form component with validation
└── lib/supabase/
    └── drawingBreakerQueries.js ✅ CRUD + search queries
```

---

## Module 12: Comber Machine Master

**Status: IMPLEMENTED ✅ (December 2, 2025)**

### Overview
- **Location:** Preparatory Master → Comber Machine
- **Purpose:** Manage comber machine details for combing process
- **Similar To:** Drawing Breaker Machine (with additional McEffi field)

### Implementation Files
```
src/lib/supabase/comberMachineQueries.js    ✅ CRUD + Search
src/components/modules/preparatory-master/ComberMachineForm.jsx  ✅ Form with mc_effi field
src/app/preparatory-master/comber/page.jsx  ✅ Full CRUD page
schema/comber-machines-setup.sql            ✅ Standalone SQL file
supabase-setup.sql                          ✅ Table 11 added
```

### Screen 1 - Comber Machine List View
**Route:** `/preparatory-master/comber`

**VB6 Grid Columns:**
| Column | DB Field | Type | Width | Description |
|--------|----------|------|-------|-------------|
| McNo | machine_no | Text | 80px | Machine number (CO1, CO2...) |
| ProdnMixing Name | prodn_mixing | Text | 120px | Production mixing (64COMBED GOLD) |
| Description | description | Text | 120px | Machine description (COMBER 1...) |
| Make | make_name | Text | 80px | Manufacturer (LMW) |
| Speed | speed | Integer | 80px | Machine speed (350-450) |
| McEffi | mc_effi | Integer | 80px | Machine efficiency (93) |

**Search Filter:**
- Field: McNo
- Condition: Like
- Value: Text input

**Sample Data (13 records from VB.NET):**
```javascript
const comberMachines = [
  { mcNo: "CO1", prodnMixing: "64COMBED GOLD", description: "COMBER 1", make: "LMW", speed: 350, mcEffi: 93 },
  { mcNo: "CO2", prodnMixing: "64COMBED GOLD", description: "COMBER 2", make: "LMW", speed: 350, mcEffi: 93 },
  { mcNo: "CO3", prodnMixing: "64COMBED GOLD", description: "COMBER 3", make: "LMW", speed: 350, mcEffi: 93 },
  { mcNo: "CO4", prodnMixing: "64COMBED GOLD", description: "COMBER 4", make: "LMW", speed: 350, mcEffi: 93 },
  { mcNo: "CO5", prodnMixing: "64COMBED GOLD", description: "COMBER 5", make: "LMW", speed: 350, mcEffi: 93 },
  { mcNo: "CO6", prodnMixing: "64COMBED GOLD", description: "COMBER 6", make: "LMW", speed: 450, mcEffi: 93 },
  { mcNo: "CO7", prodnMixing: "64COMBED GOLD", description: "COMBER 7", make: "LMW", speed: 400, mcEffi: 93 },
  { mcNo: "CO8", prodnMixing: "64COMBED GOLD", description: "COMBER 8", make: "LMW", speed: 400, mcEffi: 93 },
  { mcNo: "CO9", prodnMixing: "64COMBED GOLD", description: "COMBER 9", make: "LMW", speed: 350, mcEffi: 93 },
  { mcNo: "CO10", prodnMixing: "64COMBED GOLD", description: "COMBER 10", make: "LMW", speed: 350, mcEffi: 93 },
  { mcNo: "CO11", prodnMixing: "64COMBED GOLD", description: "COMBER 11", make: "LMW", speed: 400, mcEffi: 93 },
  { mcNo: "CO12", prodnMixing: "64COMBED GOLD", description: "COMBER 12", make: "LMW", speed: 400, mcEffi: 93 },
  { mcNo: "CO13", prodnMixing: "64COMBED GOLD", description: "COMBER 13", make: "LMW", speed: 400, mcEffi: 93 },
];
```

### Screen 2 - Comber Machine Form (Modal)
**Title:** "Comber Machine Master"
**Subtitle:** "To Add, Modify Machine Make Details"

**VB6 Form Fields (Similar to Drawing Breaker + McEffi):**
| Field | DB Column | Type | Required | Description |
|-------|-----------|------|----------|-------------|
| M\C No. | machine_no | Text | Yes | Machine identifier (CO1, CO2...) |
| M/c ID | mc_id | Integer | Yes | Numeric ID (14...) |
| Description | description | Text | No | Machine description (COMBER 1...) |
| Make Name | make_name | Text | No | Manufacturer name (LMW) |
| Model | model | Text | No | Model name |
| ProdnMixing | prodn_mixing | Text | No | Production mixing (64COMBED GOLD) |
| Speed | speed | Integer | No | Machine speed |
| Prodn Effi. | prodn_efficiency | Decimal | No | Production efficiency % |
| **M/C Effi** | **mc_effi** | **Integer** | No | **Machine efficiency % (NEW!)** |
| Installed Date | installed_date | Date | No | Installation date |
| Active | is_active | Boolean | No | Yes/No checkbox |
| Direct Hank Entry | direct_hank_entry | Boolean | No | Yes/No checkbox |
| Prod Kgs Entry | direct_kgs_entry | Boolean | No | Yes/No checkbox |

**Buttons:**
- Save (Primary)
- Cancel (Secondary)

### Database Schema
**Similar to Drawing Breaker + mc_effi field**
```sql
CREATE TABLE IF NOT EXISTS comber_machines (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  machine_no TEXT NOT NULL UNIQUE,
  description TEXT,
  make_name TEXT,
  mc_id INTEGER,
  model TEXT,
  prodn_mixing TEXT,
  speed INTEGER,
  prodn_efficiency DECIMAL(5,2) DEFAULT 0,
  mc_effi INTEGER DEFAULT 0,  -- NEW FIELD for Comber
  installed_date DATE DEFAULT '2015-04-01',
  is_active BOOLEAN DEFAULT true,
  direct_hank_entry BOOLEAN DEFAULT false,
  direct_kgs_entry BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Sample Insert Data
```sql
INSERT INTO comber_machines (machine_no, description, make_name, prodn_mixing, speed, mc_effi, mc_id, is_active) VALUES
('CO1', 'COMBER 1', 'LMW', '64COMBED GOLD', 350, 93, 1, true),
('CO2', 'COMBER 2', 'LMW', '64COMBED GOLD', 350, 93, 2, true),
('CO3', 'COMBER 3', 'LMW', '64COMBED GOLD', 350, 93, 3, true),
('CO4', 'COMBER 4', 'LMW', '64COMBED GOLD', 350, 93, 4, true),
('CO5', 'COMBER 5', 'LMW', '64COMBED GOLD', 350, 93, 5, true),
('CO6', 'COMBER 6', 'LMW', '64COMBED GOLD', 450, 93, 6, true),
('CO7', 'COMBER 7', 'LMW', '64COMBED GOLD', 400, 93, 7, true),
('CO8', 'COMBER 8', 'LMW', '64COMBED GOLD', 400, 93, 8, true),
('CO9', 'COMBER 9', 'LMW', '64COMBED GOLD', 350, 93, 9, true),
('CO10', 'COMBER 10', 'LMW', '64COMBED GOLD', 350, 93, 10, true),
('CO11', 'COMBER 11', 'LMW', '64COMBED GOLD', 400, 93, 11, true),
('CO12', 'COMBER 12', 'LMW', '64COMBED GOLD', 400, 93, 12, true),
('CO13', 'COMBER 13', 'LMW', '64COMBED GOLD', 400, 93, 13, true);
```

### Comparison with Previous Modules
| Feature | Carding | Drawing Breaker | Comber |
|---------|---------|-----------------|--------|
| McNo Prefix | CA | BD | CO |
| Total Machines | 22 | 5 | 13 |
| Has McEffi | ❌ | ❌ | ✅ (NEW) |
| ProdnMixing | "-" | "64" | "64COMBED GOLD" |
| Make | - | LMW | LMW |
| Speed Range | - | 500-800 | 350-450 |

---

## Module 13: Drawing Finisher Machine Master

**Status: IMPLEMENTED ✅ (December 2, 2025)**

### Overview
- **Location:** Preparatory Master → Drawing Finisher Machine
- **Purpose:** Manage drawing finisher machine details (after combing process)
- **Similar To:** Drawing Breaker Machine (same structure, NO McEffi field)

### Implementation Files
```
src/lib/supabase/drawingFinisherQueries.js       ✅ CRUD + Search
src/components/modules/preparatory-master/DrawingFinisherForm.jsx  ✅ Form (no mc_effi)
src/app/preparatory-master/drawing-finisher/page.jsx  ✅ Full CRUD page
schema/drawing-finisher-machines-setup.sql       ✅ Standalone SQL file
supabase-setup.sql                               ✅ Table 12 added
```

### Screen 1 - Drawing Finisher Machine List View
**Route:** `/preparatory-master/drawing-finisher`

**VB6 Grid Columns (Same as Drawing Breaker):**
| Column | DB Field | Type | Width | Description |
|--------|----------|------|-------|-------------|
| McNo | machine_no | Text | 80px | Machine number (FD1, FD2...) |
| Mixing Name | prodn_mixing | Text | 120px | Production mixing |
| Description | description | Text | 120px | Machine description |
| Make | make_name | Text | 80px | Manufacturer |
| Speed | speed | Integer | 80px | Machine speed |

**Search Filter:**
- Field: Mcno
- Condition: Like
- Value: Text input

**Expected Data Pattern (Based on Drawing Breaker & Industry Standard):**
- Machine No Prefix: FD (Finisher Drawing)
- Typical machines: FD1, FD2, FD3, etc.
- Make: LMW (same as other preparatory machines)
- Speed: Similar range to Drawing Breaker (400-800)

### Screen 2 - Drawing Finisher Machine Form (Modal)
**Title:** "Draw Frame Finisher M/c Master"
**Subtitle:** "To Add, Modify Machine Make Details"

**VB6 Form Fields (Same as Drawing Breaker - NO McEffi):**
| Field | DB Column | Type | Required | Description |
|-------|-----------|------|----------|-------------|
| M/C No. | machine_no | Text | Yes | Machine identifier (FD1, FD2...) |
| M/c ID | mc_id | Integer | No | Numeric ID |
| Description | description | Text | No | Machine description |
| Make Name | make_name | Text | No | Manufacturer name |
| Model | model | Text | No | Model name |
| ProdnMixing | prodn_mixing | Text | No | Production mixing |
| Speed | speed | Integer | No | Machine speed |
| Prodn Effi. | prodn_efficiency | Decimal | No | Production efficiency % |
| Installed Date | installed_date | Date | No | Installation date |
| Active | is_active | Boolean | No | Yes/No checkbox |
| Direct Hank Entry | direct_hank_entry | Boolean | No | Yes/No checkbox |
| Direct Kgs Entry | direct_kgs_entry | Boolean | No | Yes/No checkbox |

**Buttons:**
- Save (Primary)
- Cancel (Secondary)

### Database Schema
**Same structure as Drawing Breaker (NO mc_effi field)**
```sql
CREATE TABLE IF NOT EXISTS drawing_finisher_machines (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  machine_no TEXT NOT NULL UNIQUE,
  description TEXT,
  make_name TEXT,
  mc_id INTEGER,
  model TEXT,
  prodn_mixing TEXT,
  speed INTEGER,
  prodn_efficiency DECIMAL(5,2) DEFAULT 0,
  installed_date DATE DEFAULT '2015-04-01',
  is_active BOOLEAN DEFAULT true,
  direct_hank_entry BOOLEAN DEFAULT false,
  direct_kgs_entry BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Sample Insert Data (Based on Industry Pattern)
```sql
INSERT INTO drawing_finisher_machines (machine_no, description, make_name, prodn_mixing, speed, mc_id, is_active) VALUES
('FD1', 'FD1', 'LMW', '64', 550, 1, true),
('FD2', 'FD2', 'LMW', '64', 500, 2, true),
('FD3', 'FD3', 'LMW', '64', 600, 3, true),
('FD4', 'FD4', 'LMW', '64', 600, 4, true),
('FD5', 'FD5', 'LMW', '64', 550, 5, true);
```

### Comparison with Similar Modules
| Feature | Drawing Breaker | Drawing Finisher | Comber |
|---------|-----------------|------------------|--------|
| McNo Prefix | BD | FD | CO |
| Has McEffi | ❌ | ❌ | ✅ |
| ProdnMixing | "64" | "64" | "64COMBED GOLD" |
| Process Stage | Before Combing | After Combing | Combing |
| Purpose | Break sliver | Finish drawing | Comb fibers |

### Implementation Notes
- **Same Pattern As:** Drawing Breaker Machine Master
- **No McEffi Field:** Unlike Comber, does not have machine efficiency field
- **Department Link:** References FINISHER DRAWING department

### Files to Create
```
src/
├── app/preparatory-master/
│   └── drawing-finisher/
│       └── page.jsx
├── components/modules/preparatory-master/
│   └── DrawingFinisherForm.jsx
└── lib/supabase/
    └── drawingFinisherQueries.js
schema/
└── drawing-finisher-machines-setup.sql
```

---

## Module 14: Simplex Machine Master

**Status: IMPLEMENTED ✅ (December 2, 2025)**

### Overview
- **Location:** Preparatory Master → Simplex Machine
- **Purpose:** Manage simplex/speed frame machine details
- **Key Difference:** Has 3 ADDITIONAL fields: mc_effi, tpi, no_of_spindles (most complex preparatory machine)

### Implementation Files
```
src/lib/supabase/simplexMachineQueries.js       ✅ CRUD + Search
src/components/modules/preparatory-master/SimplexMachineForm.jsx  ✅ Form with TPI & Spindles
src/app/preparatory-master/simplex/page.jsx     ✅ Full CRUD page (8 grid columns)
schema/simplex-machines-setup.sql               ✅ Standalone SQL file
supabase-setup.sql                              ✅ Table 13 added
```

### Screen 1 - Simplex Machine List View
**Route:** `/preparatory-master/simplex`

**VB6 Grid Columns (8 columns - most columns!):**
| Column | DB Field | Type | Width | Description |
|--------|----------|------|-------|-------------|
| McNo | machine_no | Text | 60px | Machine number (1, 2, 3...) |
| Mixing Name | prodn_mixing | Text | 130px | Production mixing |
| Description | description | Text | 100px | Machine description |
| Make | make_name | Text | 60px | Manufacturer |
| Speed | speed | Integer | 60px | Machine speed (960-1050) |
| MCEffi | mc_effi | Integer | 60px | Machine efficiency (92) |
| TPI | tpi | Decimal | 50px | TPI value (1.66-1.73) |
| NoofSpl | no_of_spindles | Integer | 70px | Number of spindles (120/140) |

**Sample Data (10 records from VB.NET):**
```javascript
const simplexMachines = [
  { mcNo: "1", mixing: "64COMBED GOLD", desc: "SIMPLEX1", make: "LMW", speed: 1040, mcEffi: 92, tpi: 1.73, noofSpl: 140 },
  { mcNo: "2", mixing: "64COMBED GOLD", desc: "SIMPLEX2", make: "LMW", speed: 1040, mcEffi: 92, tpi: 1.73, noofSpl: 140 },
  { mcNo: "3", mixing: "60CCT", desc: "SIMPLEX3", make: "LMW", speed: 1050, mcEffi: 92, tpi: 1.69, noofSpl: 140 },
  { mcNo: "4", mixing: "60CC", desc: "SIMPLEX4", make: "LMW", speed: 980, mcEffi: 92, tpi: 1.73, noofSpl: 120 },
  { mcNo: "5", mixing: "60CC", desc: "SIMPLEX5", make: "LMW", speed: 1050, mcEffi: 92, tpi: 1.66, noofSpl: 140 },
  { mcNo: "6", mixing: "60CC", desc: "SIMPLEX6", make: "LMW", speed: 980, mcEffi: 92, tpi: 1.73, noofSpl: 120 },
  { mcNo: "7", mixing: "64COMBED GOLD", desc: "SIMPLEX7", make: "LMW", speed: 1050, mcEffi: 92, tpi: 1.69, noofSpl: 120 },
  { mcNo: "8", mixing: "64COMBED GOLD", desc: "SIMPLEX8", make: "LMW", speed: 1050, mcEffi: 92, tpi: 1.69, noofSpl: 120 },
  { mcNo: "9", mixing: "60CC", desc: "SIMPLEX9", make: "LMW", speed: 1040, mcEffi: 92, tpi: 1.73, noofSpl: 120 },
  { mcNo: "10", mixing: "64COMBED GOLD", desc: "SIMPLEX10", make: "LMW", speed: 960, mcEffi: 92, tpi: 1.69, noofSpl: 120 },
];
```

### Screen 2 - Simplex Machine Form (Modal)
**Title:** "Simplex M/c Master"
**Subtitle:** "To Add, Modify Machine Make Details"

**VB6 Form Fields (Most fields of all machines!):**
| Field | DB Column | Type | Required | Description |
|-------|-----------|------|----------|-------------|
| M/C No. | machine_no | Text | Yes | Machine identifier (1, 2...) |
| M/c ID | mc_id | Integer | No | Numeric ID |
| Description | description | Text | Yes | Machine description |
| Make Name | make_name | Text | No | Manufacturer name |
| Model | model | Text | No | Model name |
| ProdnMixing | prodn_mixing | Text | No | Production mixing |
| Speed | speed | Integer | No | Machine speed |
| Prodn Effi. | prodn_efficiency | Decimal | No | Production efficiency % |
| **M/C Effi.** | **mc_effi** | **Integer** | No | **Machine efficiency %** |
| **TPI** | **tpi** | **Decimal** | No | **TPI value (NEW!)** |
| **No. of Spindles** | **no_of_spindles** | **Integer** | No | **Spindle count (NEW!)** |
| Installed Date | installed_date | Date | No | Installation date |
| Active | is_active | Boolean | No | Yes/No checkbox |
| Direct Hank Entry | direct_hank_entry | Boolean | No | Yes/No checkbox |
| Direct Prod Kgs | direct_kgs_entry | Boolean | No | Yes/No checkbox |

### Database Schema
```sql
CREATE TABLE IF NOT EXISTS simplex_machines (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  machine_no TEXT NOT NULL UNIQUE,
  description TEXT,
  make_name TEXT,
  mc_id INTEGER,
  model TEXT,
  prodn_mixing TEXT,
  speed INTEGER,
  prodn_efficiency DECIMAL(5,2) DEFAULT 0,
  mc_effi INTEGER DEFAULT 0,           -- Machine Efficiency
  tpi DECIMAL(5,2) DEFAULT 0,          -- TPI value (NEW)
  no_of_spindles INTEGER DEFAULT 0,    -- Number of Spindles (NEW)
  installed_date DATE DEFAULT '2015-04-01',
  is_active BOOLEAN DEFAULT true,
  direct_hank_entry BOOLEAN DEFAULT false,
  direct_kgs_entry BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Comparison with Other Preparatory Machines
| Feature | Carding | Drawing Breaker | Comber | Drawing Finisher | Simplex |
|---------|---------|-----------------|--------|------------------|---------|
| McNo Prefix | CA | BD | CO | FD | 1-10 |
| Count | 22 | 5 | 13 | 5 | 10 |
| mc_effi | ❌ | ❌ | ✅ | ❌ | ✅ |
| tpi | ❌ | ❌ | ❌ | ❌ | ✅ (NEW) |
| no_of_spindles | ❌ | ❌ | ❌ | ❌ | ✅ (NEW) |
| Grid Columns | 5 | 5 | 6 | 5 | **8** |

### Unique Characteristics
1. Machine numbers are just integers (1, 2, 3...) not prefixed
2. Has 3 additional fields: mc_effi, tpi, no_of_spindles
3. Most columns in grid (8 columns)
4. TPI values vary: 1.66, 1.69, 1.73
5. Spindle counts: 120 or 140
6. Mixed mixing values: 64COMBED GOLD, 60CCT, 60CC

---

## Module 15: Lap Former Machine Master

### Status: IMPLEMENTED ✅

### Overview
The Lap Former Machine Master manages lap former machines in the preparatory department. This is a simpler module with only 3 machines (LF1-LF3) and follows the same structure as Drawing Breaker without the mc_effi field.

### VB.NET Analysis (frmLapFormer.frm)

#### Grid Columns (5 columns)
| VB.NET Column | Database Column | Description |
|---------------|-----------------|-------------|
| McNo | machine_no | Machine Number (LF1, LF2, LF3) |
| ProdnMixing Name | prodn_mixing | Production Mixing Name |
| Description | description | Machine Description |
| Make | make_name | Machine Make (LMW) |
| Speed | speed | Machine Speed |

#### Sample Data from VB.NET (3 machines)
| McNo | ProdnMixing Name | Description | Make | Speed |
|------|------------------|-------------|------|-------|
| LF1 | 60CC | LABFORMER 1 | LMW | 130 |
| LF2 | 64COMBED GOLD | LABFORMER 2 | LMW | 94 |
| LF3 | 64COMBED GOLD | LABFORMER 3 | LMW | 94 |

### Form Fields (12 fields)
1. **machine_no** - VARCHAR(20) - Machine Number (LF1, LF2, LF3)
2. **description** - VARCHAR(255) - Machine Description
3. **make_name** - VARCHAR(100) - Machine Make
4. **prodn_mixing** - VARCHAR(100) - Production Mixing Name
5. **speed** - INTEGER - Machine Speed
6. **mc_id** - INTEGER - Machine ID (auto-generated)
7. **is_active** - BOOLEAN - Active Status

### Database Schema
```sql
CREATE TABLE IF NOT EXISTS lap_former_machines (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  machine_no VARCHAR(20) NOT NULL UNIQUE,
  description VARCHAR(255),
  make_name VARCHAR(100),
  prodn_mixing VARCHAR(100),
  speed INTEGER,
  mc_id INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Implementation Files
- `schema/lap-former-machines-setup.sql` - Standalone SQL with 3 machines
- `src/lib/supabase/lapFormerQueries.js` - CRUD operations
- `src/components/modules/preparatory-master/LapFormerForm.jsx` - Form component
- `src/app/preparatory-master/lap-former/page.jsx` - Full CRUD page

### Comparison with Drawing Breaker
| Feature | Drawing Breaker | Lap Former |
|---------|-----------------|------------|
| McNo Prefix | BD | LF |
| Count | 5 | 3 |
| mc_effi | ❌ | ❌ |
| Grid Columns | 5 | 5 |
| Make | LMW | LMW |

### Unique Characteristics
1. Smallest machine count (only 3 machines)
2. Machine numbers prefixed with "LF" (LF1, LF2, LF3)
3. Same structure as Drawing Breaker (no mc_effi)
4. Speeds vary: 94 for LF2/LF3, 130 for LF1
5. Used in combing process preparation

---

## Module 16: Carding Entry (Preparatory Entry)

### Status: IMPLEMENTED ✅ (Database Schema Only)

### Overview
The Carding Entry module is part of the "Preparatory Entry" section. It manages production data entry for carding machines with three tabs:
1. **Production Entry** - Per machine production data with calculated fields
2. **Stoppage Entry** - Machine stoppage tracking (up to 4 stoppages)
3. **Machine Setup** - Configuration for calculation constants

### VB.NET Analysis (frmCardingProduction.frm)

#### Header Fields
| Field | Type | Description |
|-------|------|-------------|
| Date | DATE | Entry date (e.g., 22-Apr-25) |
| Shift | INTEGER | Shift number (1, 2, 3) |
| Supervisor | DROPDOWN | Supervisor name (e.g., HARIHARAN AGT) |
| Maisitry | DROPDOWN | Maisitry name (can be NIL) |

#### Production Entry Grid Columns (12 columns)
| Column | Database Field | Description | Source |
|--------|----------------|-------------|--------|
| Mc. No. | machine_no | Machine Number (CA1-CA22) | carding_machines |
| Emp. Name | employee_name | Employee Name | Manual Entry |
| Count | count_mixing | Count/Mixing (64COMBED GOLD) | Machine Master |
| Act. Hank | act_hank | Actual Hank | EL Measure Device |
| Act. Prodn | act_prodn | Actual Production (kg) | EL Measure Device |
| Exp. Prodn | exp_prodn | Expected Production (kg) | **Calculated** |
| Effi% | effi_percent | Efficiency Percentage | **Calculated** |
| UTI | uti_percent | Utilization Percentage | **Calculated** |
| Waste | waste | Waste in kg | Default 0.34 |
| Waste% | waste_percent | Waste Percentage | **Calculated** |
| Run Time | run_time | Run Time (mins) | From Header |
| WorkTime | work_time | Work Time (mins) | **Calculated** |

#### Stoppage Entry Grid Columns (10 columns)
| Column | Database Field | Description |
|--------|----------------|-------------|
| Mc. No. | machine_no | Machine Number |
| Session | session_no | Session Number |
| Effi | effi_percent | Efficiency |
| Shift Time | total_time | Total Shift Time (510) |
| Stoppage 1 | stoppage1_id | First Stoppage Reason |
| S. Time 1 | stoppage1_time | First Stoppage Time |
| Stoppage 2 | stoppage2_id | Second Stoppage Reason |
| S. Time 2 | stoppage2_time | Second Stoppage Time |
| Stoppage 3 | stoppage3_id | Third Stoppage Reason |
| S. Time 3 | stoppage3_time | Third Stoppage Time |
| Stoppage 4 | stoppage4_id | Fourth Stoppage Reason |
| S. Time 4 | stoppage4_time | Fourth Stoppage Time |

### Calculation Formulas (from carding-formula.md)

#### Machine Constants
- **Speed** = 176.7
- **Hank Constant** = 0.13
- **Std Efficiency Factor** = 0.98
- **Divisor Constant** = 1693
- **Default Waste** = 0.34 kg
- **Shift Time (Total Time)** = 510 mins
- **Default Stoppage** = 135 mins

#### STEP 1: Run Time & Work Time
```
Run Time = Total Time − Stoppage Time
Work Time = Run Time
Example: Run Time = 510 − 135 = 375 mins
```

#### STEP 2: Standard Production
```
Std Prodn = (Speed / 1693 / 0.13) × Run Time × 0.98
Example: Std Prodn = (176.7 / 1693 / 0.13) × 375 × 0.98 = 295.23 kg
```

#### STEP 3: Expected Production
```
Exp Prodn = Std Prodn / Total Time × Run Time
Example: Exp Prodn = 295.23 × 375 / 510 = 217.07 kg
```

#### STEP 4: Efficiency % (Performance)
```
Effi% = Actual Production / Expected Production × 100
Example: Effi% = 225.82 / 217.07 × 100 = 104.03%
```

#### STEP 5: Utilization %
```
UTI% = Run Time / Total Time × 100
Example: UTI = 375 / 510 × 100 = 73.53%
```

#### STEP 6: Waste %
```
Waste% = Waste / Actual Production × 100
Example: Waste% = 0.34 / 225.82 × 100 = 0.15%
```

### Sample Data (From VB6 Screenshot - 22-Apr-2025, Shift 1)

| Mc.No. | Emp.Name | Count | Act.Hank | Act.Prodn | Exp.Prodn | Effi% | UTI | Waste | Waste% | RunTime | WorkTime |
|--------|----------|-------|----------|-----------|-----------|-------|-----|-------|--------|---------|----------|
| CA1 | SANKARESWARI G | 64COMBED GOLD | 64.72 | 225.82 | 217.07 | 104.03 | 73.53 | 0.34 | 0.15 | 510 | 375 |
| CA2 | SANKARESWARI G | 64COMBED GOLD | 62.05 | 216.49 | 217.07 | 99.73 | 73.53 | 0.34 | 0.16 | 510 | 375 |
| CA3 | SANKARESWARI G | 64COMBED GOLD | 63.64 | 222.05 | 217.07 | 102.29 | 73.53 | 0.34 | 0.15 | 510 | 375 |
| CA4 | SANKARESWARI G | 64COMBED GOLD | 63.49 | 221.52 | 217.07 | 102.05 | 73.53 | 0.34 | 0.15 | 510 | 375 |
| CA5 | SANKARESWARI G | 64COMBED GOLD | 60.93 | 212.58 | 217.07 | 97.93 | 73.53 | 0.34 | 0.16 | 510 | 375 |
| CA6 | SANKARESWARI G | 64COMBED GOLD | 62.98 | 219.75 | 217.07 | 101.23 | 73.53 | 0.34 | 0.15 | 510 | 375 |
| CA7 | SANKARESWARI G | 64COMBED GOLD | 62.31 | 217.40 | 217.07 | 100.15 | 73.53 | 0.34 | 0.16 | 510 | 375 |
| CA8 | SANKARESWARI G | 64COMBED GOLD | 10.37 | 36.18 | 43.41 | 83.34 | 14.71 | 0.34 | 0.94 | 510 | 75 |
| CA9 | SANKARESWARI G | 64COMBED GOLD | 40.58 | 141.60 | 217.07 | 65.23 | 73.53 | 0.34 | 0.24 | 510 | 375 |
| CA10 | SANKARESWARI G | 64COMBED GOLD | 42.02 | 146.62 | 217.07 | 67.55 | 73.53 | 0.34 | 0.23 | 510 | 375 |
| CA11 | SANKARESWARI G | 64COMBED GOLD | 60.61 | 196.37 | 208.39 | 94.23 | 70.59 | 0.34 | 0.17 | 510 | 360 |
| CA12 | SANKARESWARI G | 64COMBED GOLD | 52.90 | 171.40 | 208.39 | 82.25 | 70.59 | 0.34 | 0.20 | 510 | 360 |
| CA13 | SANKARESWARI G | 64COMBED GOLD | 60.04 | 209.48 | 208.39 | 100.52 | 70.59 | 0.34 | 0.16 | 510 | 360 |
| CA14 | SANKARESWARI G | 64COMBED GOLD | 58.48 | 204.05 | 208.39 | 97.92 | 70.59 | 0.34 | 0.17 | 510 | 360 |
| CA15 | SANKARESWARI G | 64COMBED GOLD | 50.99 | 177.89 | 179.44 | 99.14 | 60.78 | 0.34 | 0.19 | 510 | 310 |
| CA16 | SANKARESWARI G | 64COMBED GOLD | 50.30 | 175.51 | 179.44 | 97.81 | 60.78 | 0.34 | 0.19 | 510 | 310 |
| CA17 | SANKARESWARI G | 64COMBED GOLD | 52.16 | 169.01 | 167.87 | 100.68 | 56.86 | 0.34 | 0.20 | 510 | 290 |

### Stoppage Data Sample

| Mc.No. | Session | Effi | Shift Time | Stoppage 1 | S.Time 1 | Stoppage 2 | S.Time 2 |
|--------|---------|------|------------|------------|----------|------------|----------|
| CA1 | 1 | 104.03 | 510 | EXCESS STOCK-->EXS | 135 | - | 0 |
| CA2-CA7 | 1 | varies | 510 | EXCESS STOCK-->EXS | 135 | - | 0 |
| CA8 | 1 | 83.34 | 510 | EXCESS STOCK-->EXS | 135 | GEAR BOX WORK-->GEW | 300 |
| CA9-CA10 | 1 | varies | 510 | EXCESS STOCK-->EXS | 135 | - | 0 |
| CA11-CA14 | 1 | varies | 510 | DAILY CLEANING-->DC | 150 | - | 0 |
| CA15-CA16 | 1 | varies | 510 | varies | 200 | - | 0 |
| CA17 | 1 | 100.68 | 510 | varies | 220 | - | 0 |

### Database Schema

#### Table 17: carding_production_header
```sql
CREATE TABLE IF NOT EXISTS carding_production_header (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  entry_id SERIAL,
  entry_date DATE NOT NULL,
  shift INTEGER NOT NULL CHECK (shift IN (1, 2, 3)),
  supervisor_id UUID REFERENCES supervisors(id) ON DELETE SET NULL,
  maisitry_id UUID REFERENCES supervisors(id) ON DELETE SET NULL,
  total_time INTEGER DEFAULT 510,
  remarks TEXT,
  is_locked BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(entry_date, shift)
);
```

#### Table 18: carding_production_detail
```sql
CREATE TABLE IF NOT EXISTS carding_production_detail (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  header_id UUID NOT NULL REFERENCES carding_production_header(id) ON DELETE CASCADE,
  machine_id UUID NOT NULL REFERENCES carding_machines(id) ON DELETE CASCADE,
  employee_name VARCHAR(100),
  count_mixing VARCHAR(100),
  act_hank DECIMAL(10,2) DEFAULT 0,
  act_prodn DECIMAL(10,2) DEFAULT 0,
  std_prodn DECIMAL(10,2) DEFAULT 0,
  exp_prodn DECIMAL(10,2) DEFAULT 0,
  effi_percent DECIMAL(10,2) DEFAULT 0,
  uti_percent DECIMAL(10,2) DEFAULT 0,
  waste DECIMAL(10,4) DEFAULT 0.34,
  waste_percent DECIMAL(10,4) DEFAULT 0,
  run_time INTEGER DEFAULT 375,
  work_time INTEGER DEFAULT 375,
  session_no INTEGER DEFAULT 1,
  is_verified BOOLEAN DEFAULT false,
  verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(header_id, machine_id)
);
```

#### Table 19: carding_stoppage_entry
```sql
CREATE TABLE IF NOT EXISTS carding_stoppage_entry (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  production_detail_id UUID NOT NULL REFERENCES carding_production_detail(id) ON DELETE CASCADE,
  stoppage1_id UUID REFERENCES stoppage_details(id) ON DELETE SET NULL,
  stoppage1_time INTEGER DEFAULT 0,
  stoppage2_id UUID REFERENCES stoppage_details(id) ON DELETE SET NULL,
  stoppage2_time INTEGER DEFAULT 0,
  stoppage3_id UUID REFERENCES stoppage_details(id) ON DELETE SET NULL,
  stoppage3_time INTEGER DEFAULT 0,
  stoppage4_id UUID REFERENCES stoppage_details(id) ON DELETE SET NULL,
  stoppage4_time INTEGER DEFAULT 0,
  total_stoppage_time INTEGER DEFAULT 0,
  is_full_stoppage BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(production_detail_id)
);
```

#### Table 20: carding_machine_setup
```sql
CREATE TABLE IF NOT EXISTS carding_machine_setup (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  machine_id UUID NOT NULL REFERENCES carding_machines(id) ON DELETE CASCADE UNIQUE,
  speed DECIMAL(10,2) DEFAULT 176.7,
  hank_constant DECIMAL(10,4) DEFAULT 0.13,
  std_efficiency_factor DECIMAL(5,4) DEFAULT 0.98,
  default_waste DECIMAL(10,4) DEFAULT 0.34,
  shift_time INTEGER DEFAULT 510,
  default_stoppage INTEGER DEFAULT 135,
  divisor_constant INTEGER DEFAULT 1693,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Carding-Specific Stoppage Reasons
| Code | Stoppage Name | Short Code |
|------|--------------|------------|
| 1500 | EXCESS STOCK | EXS |
| 1501 | DAILY CLEANING | DC |
| 1502 | GEAR BOX WORK | GEW |
| 1503 | CARD CLOTHING CHANGE | CCC |
| 1504 | COILER PROBLEM | CLP |
| 1505 | DOFFER PROBLEM | DFP |
| 1506 | MATERIAL SHORTAGE | MS |

### Implementation Files
- `schema/carding-entry-setup.sql` - Standalone SQL with all 4 tables and sample data
- `supabase-setup.sql` - Tables 17-20 added
- `formula/carding-formula.md` - Calculation formulas reference

### UI Features (To Be Implemented)
1. **Production Entry Tab**
   - Date picker, Shift dropdown, Supervisor/Maisitry dropdowns
   - Grid with 12 columns
   - Auto-calculation on Act.Hank/Act.Prodn input
   - "EL Measure Data" button for device input

2. **Stoppage Entry Tab**
   - Grid with stoppage reasons and times
   - "Full Stoppage" section (applies to all machines)
   - "Partial Stoppage" section (from/to machine range)

3. **Machine Setup Tab**
   - Configure calculation constants per machine
   - Speed, Hank Constant, Efficiency Factor, etc.

---

## Module 17: Breaker Drawing Entry (Preparatory Entry)

### Status: IMPLEMENTED ✅ (Database Schema Only)

### Overview
The Breaker Drawing Entry module is part of the "Preparatory Entry" section. It manages production data entry for breaker drawing machines with three tabs:
1. **Production Entry** - Per machine production data with calculated fields
2. **Stoppage Entry** - Machine stoppage tracking (up to 3 stoppages typically)
3. **Machine Setup** - Configuration for calculation constants (includes Delivery field)

### Key Differences from Carding Entry
| Feature | Carding | Breaker Drawing |
|---------|---------|-----------------|
| Machines | 22 (CA1-CA22) | 4 (BD1-BD4) |
| Delivery Field | N/A | Yes (1 or 2) |
| Speed Range | ~130-177 | 450-750 |
| Hank Constant | 0.13 | 0.14 |
| Std Efficiency | 98% | 85% |
| Default Waste | 0.34 kg | 0.85 kg |

### VB.NET Analysis (frmBreakerDrawingProduction.frm)

#### Header Fields
| Field | Type | Description |
|-------|------|-------------|
| Date | DATE | Entry date (e.g., 22-Apr-25) |
| Shift | INTEGER | Shift number (1, 2, 3) |
| Supervisor | DROPDOWN | Supervisor name (e.g., HARIHARAN AGT) |
| Maisitry | DROPDOWN | Maisitry name (can be NIL) |

#### Production Entry Grid Columns (12 columns)
| Column | Database Field | Description | Source |
|--------|----------------|-------------|--------|
| Mc. No. | machine_no | Machine Number (BD1-BD4) | drawing_breaker_machines |
| Emp. Name | employee_name | Employee Name | Manual Entry |
| Mixing | prodn_mixing | Count/Mixing (64COMBED GOLD) | Machine Master |
| Act. Hank | act_hank | Actual Hank | EL Measure Device |
| Act. Prodn | act_prodn | Actual Production (kg) | EL Measure Device |
| Exp. Prodn | exp_prodn | Expected Production (kg) | **Calculated** |
| Waste | waste | Waste in kg | Default 0.85 |
| Waste% | waste_percent | Waste Percentage | **Calculated** |
| Act.Effi | effi_percent | Efficiency Percentage | **Calculated** |
| UTI | uti_percent | Utilization Percentage | **Calculated** |
| Run Time | run_time | Total Time (510 mins) | From Header |
| WorkTime | work_time | Work Time (mins) | **Calculated** |

#### Stoppage Entry Grid Columns (10 columns)
| Column | Database Field | Description |
|--------|----------------|-------------|
| Mcno | machine_no | Machine Number |
| session | session_no | Session Number |
| Effi | effi_percent | Efficiency |
| R.Time | total_time | Total Shift Time (510) |
| Stoppage 1 | stoppage1_id | First Stoppage Reason |
| S. Time 1 | stoppage1_time | First Stoppage Time |
| Stoppage 2 | stoppage2_id | Second Stoppage Reason |
| S. Time 2 | stoppage2_time | Second Stoppage Time |
| Stoppage 3 | stoppage3_id | Third Stoppage Reason |
| S. Time 3 | stoppage3_time | Third Stoppage Time |

#### Machine Setup Grid Columns (10 columns)
| Column | Database Field | Description |
|--------|----------------|-------------|
| Mc. No. | machine_no | Machine Number |
| Make Name | make_name | Manufacturer (LMW) |
| Mixing | prodn_mixing | Count/Mixing |
| Session | session_no | Session Number |
| Shift Time | shift_time | Total shift time (510) |
| Std. Prodn | std_prodn | Standard Production (kg) |
| Speed | speed | Machine Speed (450-750) |
| Std. Effi | std_efficiency_factor | Standard Efficiency (85%) |
| Sl.Hank | hank_constant | Sliver Hank (0.14) |
| Delivery | delivery | Delivery count (1 or 2) |

### Calculation Formulas (from breaker-drawing-formula.md)

#### Machine Constants (per Machine Setup)
| Machine | Speed | Hank | Std Effi | Delivery | Std Prodn |
|---------|-------|------|----------|----------|-----------|
| BD1 | 450 | 0.14 | 85% | 2 | 1646.06 kg |
| BD2 | 750 | 0.14 | 85% | 1 | 1371.72 kg |
| BD3 | 750 | 0.14 | 85% | 1 | 1371.72 kg |
| BD4 | 750 | 0.14 | 85% | 1 | 1371.72 kg |

- **Divisor Constant** = 1693
- **Default Waste** = 0.85 kg
- **Shift Time (Total Time)** = 510 mins

#### STEP 1: Run Time & Work Time
```
Total Stoppage = Stoppage1_Time + Stoppage2_Time + Stoppage3_Time
Run Time = Total Time − Total Stoppage
Work Time = Run Time

Example BD1: 
Total Stoppage = 160 + 60 + 20 = 240 mins
Run Time = 510 − 240 = 270 mins
Work Time = 270 mins
```

#### STEP 2: Standard Production (Std Prodn)
```
Std Prodn = Speed / 1693 / Hank × Total Time × Std Effi × Delivery

Example BD1:
Std Prodn = 450 / 1693 / 0.14 × 510 × 0.85 × 2
         = 0.2658 / 0.14 × 510 × 0.85 × 2
         = 1.8986 × 510 × 0.85 × 2
         = 1646.06 kg
```

#### STEP 3: Expected Production (Exp Prodn)
```
Exp Prodn = Std Prodn × (Run Time / Total Time)

Example BD1:
Exp Prodn = 1646.06 × (270 / 510)
          = 1646.06 × 0.5294
          = 871.44 kg
```

#### STEP 4: Actual Efficiency % (Act.Effi)
```
Act Effi % = Actual Prodn / Exp Prodn × 100

Example BD1:
Act Effi = 864.20 / 871.44 × 100 = 99.17%
```

#### STEP 5: Utilization % (UTI)
```
UTI % = Run Time / Total Time × 100

Example BD1:
UTI = 270 / 510 × 100 = 52.94%
```

#### STEP 6: Waste %
```
Waste % = Waste / Actual Prodn × 100

Example BD1:
Waste% = 0.85 / 864.20 × 100 = 0.10%
```

### Sample Data (From VB6 Screenshot - 22-Apr-2025, Shift 1)

#### Production Entry Data
| Mc.No. | Emp.Name | Mixing | Act.Hank | Act.Prodn | Exp.Prodn | Waste | Waste% | Act.Effi | UTI | RunTime | WorkTime |
|--------|----------|--------|----------|-----------|-----------|-------|--------|----------|-----|---------|----------|
| BD1 | MURUGESWARI. M | 64COMBED GOLD | 133.36 | 864.20 | 871.44 | 0.85 | 0.10 | 99.17 | 52.94 | 510 | 270 |
| BD2 | MURUGESWARI. M | 64COMBED GOLD | 213.50 | 691.77 | 699.31 | 0.85 | 0.12 | 98.92 | 50.98 | 510 | 260 |
| BD3 | MURUGESWARI. M | 64COMBED GOLD | 341.91 | 1107.83 | 1102.76 | 0.85 | 0.08 | 100.46 | 80.39 | 510 | 410 |
| BD4 | GANDHIMATHI K | 64COMBED GOLD | 307.04 | 994.85 | 995.17 | 0.85 | 0.09 | 99.97 | 72.55 | 510 | 370 |

#### Stoppage Entry Data
| Mc.No. | Session | Effi | R.Time | Stoppage 1 | S.Time 1 | Stoppage 2 | S.Time 2 | Stoppage 3 | S.Time 3 |
|--------|---------|------|--------|------------|----------|------------|----------|------------|----------|
| BD1 | 1 | 99.17 | 510 | EXCESS STOCK-->EWZ | 160 | BSS-->BN | 60 | AIR CLEANING-->AIL | 20 |
| BD2 | 1 | 98.92 | 510 | EXCESS STOCK-->EWZ | 170 | BSS-->BN | 60 | AIR CLEANING-->AIL | 20 |
| BD3 | 1 | 100.46 | 510 | EXCESS STOCK-->EWZ | 20 | BSS-->BN | 60 | AIR CLEANING-->AIL | 20 |
| BD4 | 1 | 99.97 | 510 | EXCESS STOCK-->EWZ | 60 | BSS-->BN | 60 | AIR CLEANING-->AIL | 20 |

### Database Schema

#### Table 21: breaker_drawing_production_header
```sql
CREATE TABLE IF NOT EXISTS breaker_drawing_production_header (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  entry_id SERIAL,
  entry_date DATE NOT NULL,
  shift INTEGER NOT NULL CHECK (shift IN (1, 2, 3)),
  supervisor_id UUID REFERENCES supervisors(id) ON DELETE SET NULL,
  maisitry_id UUID REFERENCES supervisors(id) ON DELETE SET NULL,
  total_time INTEGER DEFAULT 510,
  remarks TEXT,
  is_locked BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(entry_date, shift)
);
```

#### Table 22: breaker_drawing_production_detail
```sql
CREATE TABLE IF NOT EXISTS breaker_drawing_production_detail (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  header_id UUID NOT NULL REFERENCES breaker_drawing_production_header(id) ON DELETE CASCADE,
  machine_id UUID NOT NULL REFERENCES drawing_breaker_machines(id) ON DELETE CASCADE,
  employee_name VARCHAR(100),
  prodn_mixing VARCHAR(100),
  act_hank DECIMAL(10,2) DEFAULT 0,
  act_prodn DECIMAL(10,2) DEFAULT 0,
  std_prodn DECIMAL(10,2) DEFAULT 0,
  exp_prodn DECIMAL(10,2) DEFAULT 0,
  effi_percent DECIMAL(10,2) DEFAULT 0,
  uti_percent DECIMAL(10,2) DEFAULT 0,
  waste DECIMAL(10,4) DEFAULT 0.85,
  waste_percent DECIMAL(10,4) DEFAULT 0,
  run_time INTEGER DEFAULT 510,
  work_time INTEGER DEFAULT 510,
  session_no INTEGER DEFAULT 1,
  is_verified BOOLEAN DEFAULT false,
  verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(header_id, machine_id)
);
```

#### Table 23: breaker_drawing_stoppage_entry
```sql
CREATE TABLE IF NOT EXISTS breaker_drawing_stoppage_entry (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  production_detail_id UUID NOT NULL REFERENCES breaker_drawing_production_detail(id) ON DELETE CASCADE,
  stoppage1_id UUID REFERENCES stoppage_details(id) ON DELETE SET NULL,
  stoppage1_time INTEGER DEFAULT 0,
  stoppage2_id UUID REFERENCES stoppage_details(id) ON DELETE SET NULL,
  stoppage2_time INTEGER DEFAULT 0,
  stoppage3_id UUID REFERENCES stoppage_details(id) ON DELETE SET NULL,
  stoppage3_time INTEGER DEFAULT 0,
  stoppage4_id UUID REFERENCES stoppage_details(id) ON DELETE SET NULL,
  stoppage4_time INTEGER DEFAULT 0,
  total_stoppage_time INTEGER DEFAULT 0,
  is_full_stoppage BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(production_detail_id)
);
```

#### Table 24: breaker_drawing_machine_setup
```sql
CREATE TABLE IF NOT EXISTS breaker_drawing_machine_setup (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  machine_id UUID NOT NULL REFERENCES drawing_breaker_machines(id) ON DELETE CASCADE UNIQUE,
  speed INTEGER DEFAULT 750,
  hank_constant DECIMAL(10,4) DEFAULT 0.14,
  std_efficiency_factor DECIMAL(5,4) DEFAULT 0.85,
  default_waste DECIMAL(10,4) DEFAULT 0.85,
  std_prodn DECIMAL(10,2) DEFAULT 1371.72,
  shift_time INTEGER DEFAULT 510,
  default_stoppage INTEGER DEFAULT 0,
  divisor_constant INTEGER DEFAULT 1693,
  delivery INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Breaker Drawing-Specific Stoppage Reasons
| Code | Stoppage Name | Short Code |
|------|--------------|------------|
| 1510 | EXCESS STOCK | EWZ |
| 1511 | BSS | BN |
| 1512 | AIR CLEANING | AIL |
| 1513 | COILER PROBLEM | CLP |
| 1514 | SUCTION PROBLEM | SP |
| 1515 | MATERIAL SHORTAGE | MS |

### Implementation Files
- `schema/breaker-drawing-setup.sql` - Standalone SQL with all 4 tables and sample data
- `supabase-setup.sql` - Tables 21-24 added
- `formula/breaker-drawing-formula.md` - Calculation formulas reference

### UI Features (To Be Implemented)
1. **Production Entry Tab**
   - Date picker, Shift dropdown, Supervisor/Maisitry dropdowns
   - Grid with 12 columns
   - Auto-calculation on Act.Hank/Act.Prodn input
   - "EL Measure Data" button for device input

2. **Stoppage Entry Tab**
   - Grid with stoppage reasons and times
   - "Full Stoppage" section (applies to all machines)
   - "Partial Stoppage" section (from/to machine range)

3. **Machine Setup Tab**
   - Configure calculation constants per machine
   - Speed, Hank Constant, Efficiency Factor, Delivery, etc.
   - "Count change", "Add new machine", "Remove machine" buttons

---

## Module 18: Lap Former Entry (Preparatory Entry)

### Status: PLANNED 📋

### Overview
The Lap Former Entry module is part of the "Preparatory Entry" section. It manages production data entry for lap former machines with three tabs:
1. **Production Entry** - Per machine production data with calculated fields
2. **Stoppage Entry** - Machine stoppage tracking (up to 4 stoppages)
3. **Machine Setup** - Configuration for calculation constants

### Key Differences from Breaker Drawing Entry
| Feature | Breaker Drawing | Lap Former |
|---------|-----------------|------------|
| Machines | 4 (BD1-BD4) | 3 (LF1-LF3) |
| Delivery Field | Yes (1 or 2) | Yes (always 1) |
| Speed Range | 450-750 | 90-120 |
| Hank Constant | 0.14 | 0.0082 |
| Std Efficiency | 85% | 85% |
| Default Waste | 0.85 kg | 0.85 kg |
| Divisor Constant | 1693 | 1693 |

### VB.NET Analysis (frmLapFormerProduction.frm)

#### Header Fields
| Field | Type | Description |
|-------|------|-------------|
| Date | DATE | Entry date (e.g., 22-Apr-25) |
| Shift | INTEGER | Shift number (1, 2, 3) |
| Supervisor | DROPDOWN | Supervisor name (e.g., CHINNADURAI. R) |
| Maisitry | DROPDOWN | Maisitry name (can be NIL) |

#### Production Entry Grid Columns (12 columns)
| Column | Database Field | Description | Source |
|--------|----------------|-------------|--------|
| Mc. No. | machine_no | Machine Number (LF1-LF3) | lap_former_machines |
| Emp. Name | employee_name | Employee Name | Manual Entry |
| Mixing | prodn_mixing | Count/Mixing (64COMBED GOLD) | Machine Master |
| Act. Hank | act_hank | Actual Hank | **EL Measure Device** |
| Act. Prodn | act_prodn | Actual Production (kg) | **EL Measure Device** |
| Exp. Prodn | exp_prodn | Expected Production (kg) | **Calculated** |
| Waste | waste | Waste in kg | Default 0.85 |
| Waste% | waste_percent | Waste Percentage | **Calculated** |
| Act.Effi | effi_percent | Efficiency Percentage | **Calculated** |
| UTI | uti_percent | Utilization Percentage | **Calculated** |
| Run Time | run_time | Total Time (510 mins) | From Header |
| WorkTime | work_time | Work Time (mins) | **Calculated** |

#### Stoppage Entry Grid Columns
| Column | Database Field | Description |
|--------|----------------|-------------|
| Mcno | machine_no | Machine Number |
| session | session_no | Session Number |
| Effi | effi_percent | Efficiency |
| R.Time | total_time | Total Shift Time (510) |
| Stoppage 1 | stoppage1_id | First Stoppage Reason |
| S. Time 1 | stoppage1_time | First Stoppage Time |
| Stoppage 2 | stoppage2_id | Second Stoppage Reason |
| S. Time 2 | stoppage2_time | Second Stoppage Time |

#### Machine Setup Grid Columns (9 columns)
| Column | Database Field | Description |
|--------|----------------|-------------|
| Mc. No. | machine_no | Machine Number |
| Make Name | make_name | Manufacturer (LMW) |
| Mixing | prodn_mixing | Count/Mixing |
| Session | session_no | Session Number |
| Shift Time | shift_time | Total shift time (510) |
| Std. Prodn | std_prodn | Standard Production (kg) |
| Speed | speed | Machine Speed (90-120) |
| Std. Effi | std_efficiency_factor | Standard Efficiency (85%) |
| Sl.Hank | hank_constant | Sliver Hank (0.0082) |

### Calculation Formulas (from lap-former-formula.md)

#### Machine Constants (per Machine Setup)
| Machine | Speed | Hank | Std Effi | Delivery | Std Prodn |
|---------|-------|------|----------|----------|-----------|
| LF1 | 120 | 0.0082 | 85% | 1 | 3747.14 kg |
| LF2 | 90 | 0.0082 | 85% | 1 | 2810.35 kg |
| LF3 | 90 | 0.0082 | 85% | 1 | 2810.35 kg |

- **Divisor Constant** = 1693
- **Default Waste** = 0.85 kg
- **Shift Time (Total Time)** = 510 mins

#### STEP 1: Run Time & Work Time
```
Total Stoppage = Stoppage1_Time + Stoppage2_Time + Stoppage3_Time + Stoppage4_Time
Run Time = Total Time − Total Stoppage
Work Time = Run Time

Example LF1: 
Total Stoppage = 180 + 120 = 300 mins
Run Time = 510 − 300 = 210 mins
Work Time = 210 mins
```

#### STEP 2: Standard Production (Std Prodn)
```
Std Prodn = Speed / 1693 / Hank × Total Time × Std Effi × Delivery

Example LF1:
Std Prodn = 120 / 1693 / 0.0082 × 510 × 0.85 × 1
         = 0.07088 / 0.0082 × 510 × 0.85 × 1
         = 8.644 × 510 × 0.85
         = 3747.14 kg
```

#### STEP 3: Expected Production (Exp Prodn)
```
Exp Prodn = Std Prodn × (Run Time / Total Time)

Example LF1:
Exp Prodn = 3747.14 × (210 / 510)
          = 3747.14 × 0.4118
          = 1542.94 kg
```

#### STEP 4: Actual Efficiency % (Act.Effi)
```
Act Effi % = Actual Prodn / Exp Prodn × 100

Example LF1:
Act Effi = 1568.85 / 1542.94 × 100 = 101.68%
```

#### STEP 5: Utilization % (UTI)
```
UTI % = Run Time / Total Time × 100

Example LF1:
UTI = 210 / 510 × 100 = 41.18%
```

#### STEP 6: Waste %
```
Waste % = Waste / Actual Prodn × 100

Example LF1:
Waste% = 0.85 / 1568.85 × 100 = 0.05%
```

### Sample Data (From VB6 Screenshot - 22-Apr-2025, Shift 1)

#### Production Entry Data
| Mc.No. | Emp.Name | Mixing | Act.Hank | Act.Prodn | Exp.Prodn | Waste | Waste% | Act.Effi | UTI | RunTime | WorkTime |
|--------|----------|--------|----------|-----------|-----------|-------|--------|----------|-----|---------|----------|
| LF1 | MURUGESWARI. M | 64COMBED GOLD | 28.36 | 1568.85 | 1542.94 | 0.85 | 0.05 | 101.68 | 41.18 | 510 | 210 |
| LF2 | MURUGESWARI. M | 64COMBED GOLD | 17.14 | 948.17 | 964.34 | 0.85 | 0.09 | 98.32 | 34.31 | 510 | 175 |
| LF3 | GANDHIMATHI K | 64COMBED GOLD | 24.04 | 1329.87 | 1322.52 | 0.85 | 0.06 | 100.56 | 47.06 | 510 | 240 |

#### Stoppage Entry Data
| Mc.No. | Session | Effi | R.Time | Stoppage 1 | S.Time 1 | Stoppage 2 | S.Time 2 | Total |
|--------|---------|------|--------|------------|----------|------------|----------|-------|
| LF1 | 1 | 101.68 | 510 | EXCESS STOCK-->EIO | 180 | SPOOL CHANGE PROB... | 120 | 300 |
| LF2 | 1 | 98.32 | 510 | EXCESS STOCK-->EIO | 245 | ERECTOR WORK-->EW | 90 | 335 |
| LF3 | 1 | 100.56 | 510 | EXCESS STOCK-->EIO | 270 | - | 0 | 270 |

#### Machine Setup Data
| Mc.No. | Make | Mixing | Session | ShiftTime | Std.Prodn | Speed | Std.Effi | Sl.Hank |
|--------|------|--------|---------|-----------|-----------|-------|----------|---------|
| LF1 | LMW | 64COMBED GOLD | 1 | 510 | 3747.14 | 120 | 85 | 0.0082 |
| LF2 | LMW | 64COMBED GOLD | 1 | 510 | 2810.35 | 90 | 85 | 0.0082 |
| LF3 | LMW | 64COMBED GOLD | 1 | 510 | 2810.35 | 90 | 85 | 0.0082 |

### Calculation Verification (All 3 Machines)

#### LF1 Verification
| Field | Calculated | Screen | Match |
|-------|------------|--------|-------|
| Stoppage | 180+120=300 | - | ✅ |
| Work Time | 510-300=210 | 210 | ✅ |
| Std Prodn | 120/1693/0.0082×510×0.85×1 | 3747.14 | ✅ |
| Exp Prodn | 3747.14×(210/510) | 1542.94 | ✅ |
| Act Effi | 1568.85/1542.94×100 | 101.68% | ✅ |
| UTI | 210/510×100 | 41.18% | ✅ |
| Waste% | 0.85/1568.85×100 | 0.05% | ✅ |

#### LF2 Verification
| Field | Calculated | Screen | Match |
|-------|------------|--------|-------|
| Stoppage | 245+90=335 | - | ✅ |
| Work Time | 510-335=175 | 175 | ✅ |
| Std Prodn | 90/1693/0.0082×510×0.85×1 | 2810.35 | ✅ |
| Exp Prodn | 2810.35×(175/510) | 964.34 | ✅ |
| Act Effi | 948.17/964.34×100 | 98.32% | ✅ |
| UTI | 175/510×100 | 34.31% | ✅ |
| Waste% | 0.85/948.17×100 | 0.09% | ✅ |

#### LF3 Verification
| Field | Calculated | Screen | Match |
|-------|------------|--------|-------|
| Stoppage | 270+0=270 | - | ✅ |
| Work Time | 510-270=240 | 240 | ✅ |
| Std Prodn | 90/1693/0.0082×510×0.85×1 | 2810.35 | ✅ |
| Exp Prodn | 2810.35×(240/510) | 1322.52 | ✅ |
| Act Effi | 1329.87/1322.52×100 | 100.56% | ✅ |
| UTI | 240/510×100 | 47.06% | ✅ |
| Waste% | 0.85/1329.87×100 | 0.06% | ✅ |

### Database Schema

#### Table 25: lap_former_production_header
```sql
CREATE TABLE IF NOT EXISTS lap_former_production_header (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  entry_id SERIAL,
  entry_date DATE NOT NULL,
  shift INTEGER NOT NULL CHECK (shift IN (1, 2, 3)),
  supervisor_id UUID REFERENCES supervisors(id) ON DELETE SET NULL,
  maisitry_id UUID REFERENCES supervisors(id) ON DELETE SET NULL,
  total_time INTEGER DEFAULT 510,
  remarks TEXT,
  is_locked BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(entry_date, shift)
);
```

#### Table 26: lap_former_production_detail
```sql
CREATE TABLE IF NOT EXISTS lap_former_production_detail (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  header_id UUID NOT NULL REFERENCES lap_former_production_header(id) ON DELETE CASCADE,
  machine_id UUID NOT NULL REFERENCES lap_former_machines(id) ON DELETE CASCADE,
  employee_name VARCHAR(100),
  prodn_mixing VARCHAR(100),
  act_hank DECIMAL(10,2) DEFAULT 0,
  act_prodn DECIMAL(10,2) DEFAULT 0,
  std_prodn DECIMAL(10,2) DEFAULT 0,
  exp_prodn DECIMAL(10,2) DEFAULT 0,
  effi_percent DECIMAL(10,2) DEFAULT 0,
  uti_percent DECIMAL(10,2) DEFAULT 0,
  waste DECIMAL(10,4) DEFAULT 0.85,
  waste_percent DECIMAL(10,4) DEFAULT 0,
  run_time INTEGER DEFAULT 510,
  work_time INTEGER DEFAULT 510,
  session_no INTEGER DEFAULT 1,
  is_verified BOOLEAN DEFAULT false,
  verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(header_id, machine_id)
);
```

#### Table 27: lap_former_stoppage_entry
```sql
CREATE TABLE IF NOT EXISTS lap_former_stoppage_entry (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  production_detail_id UUID NOT NULL REFERENCES lap_former_production_detail(id) ON DELETE CASCADE,
  stoppage1_id UUID REFERENCES stoppage_details(id) ON DELETE SET NULL,
  stoppage1_time INTEGER DEFAULT 0,
  stoppage2_id UUID REFERENCES stoppage_details(id) ON DELETE SET NULL,
  stoppage2_time INTEGER DEFAULT 0,
  stoppage3_id UUID REFERENCES stoppage_details(id) ON DELETE SET NULL,
  stoppage3_time INTEGER DEFAULT 0,
  stoppage4_id UUID REFERENCES stoppage_details(id) ON DELETE SET NULL,
  stoppage4_time INTEGER DEFAULT 0,
  total_stoppage_time INTEGER DEFAULT 0,
  is_full_stoppage BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(production_detail_id)
);
```

#### Table 28: lap_former_machine_setup
```sql
CREATE TABLE IF NOT EXISTS lap_former_machine_setup (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  machine_id UUID NOT NULL REFERENCES lap_former_machines(id) ON DELETE CASCADE UNIQUE,
  speed INTEGER DEFAULT 90,
  hank_constant DECIMAL(10,4) DEFAULT 0.0082,
  std_efficiency_factor DECIMAL(5,4) DEFAULT 0.85,
  default_waste DECIMAL(10,4) DEFAULT 0.85,
  std_prodn DECIMAL(10,2) DEFAULT 2810.35,
  shift_time INTEGER DEFAULT 510,
  default_stoppage INTEGER DEFAULT 0,
  divisor_constant INTEGER DEFAULT 1693,
  delivery INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Lap Former-Specific Stoppage Reasons
| Code | Stoppage Name | Short Code |
|------|---------------|------------|
| 1520 | EXCESS STOCK | EIO |
| 1521 | SPOOL CHANGE PROBLEM | SCP |
| 1522 | ERECTOR WORK | EW |
| 1469 | PISTON SOFT WORK | PSW |
| 1474 | DRAFTING SETTING WORK | DSW |

### Implementation Files (To Be Created)
- `schema/lap-former-entry-setup.sql` - Standalone SQL with all 4 tables and sample data
- `src/lib/supabase/lapFormerEntryQueries.js` - CRUD operations
- `src/app/preparatory-entry/lap-former/page.jsx` - Entry page with 3 tabs
- `src/components/modules/preparatory-entry/LapFormerProductionTab.jsx`
- `src/components/modules/preparatory-entry/LapFormerStoppageTab.jsx`
- `src/components/modules/preparatory-entry/LapFormerMachineSetupTab.jsx`

### UI Features (To Be Implemented)
1. **Production Entry Tab**
   - Date picker, Shift dropdown, Supervisor/Maisitry dropdowns
   - Grid with 12 columns
   - Auto-calculation on stoppage changes
   - "EL Measure Data" button for device input (Act.Hank, Act.Prodn)

2. **Stoppage Entry Tab**
   - Grid with stoppage reasons and times
   - "Full Stoppage" section (applies to all machines)
   - "Partial Stoppage" section (from/to machine range)

3. **Machine Setup Tab**
   - Configure calculation constants per machine
   - Speed, Hank Constant (0.0082), Efficiency Factor (85%)
   - "Count change", "Add new machine", "Remove machine" buttons

---

## Module 19: Finisher Drawing Entry (Preparatory Entry)

### Status: PLANNED 📋

### Overview
The Finisher Drawing Entry module is part of the "Preparatory Entry" section. It manages production data entry for finisher drawing machines with three tabs:
1. **Production Entry** - Per machine production data with calculated fields
2. **Stoppage Entry** - Machine stoppage tracking (up to 4 stoppages)
3. **Machine Setup** - Configuration for calculation constants

### Key Differences from Other Drawing Modules
| Feature | Breaker Drawing | Finisher Drawing |
|---------|-----------------|------------------|
| Machines | 4 (BD1-BD4) | 7 (FD4-FD10) |
| Machine Makes | N/A | RIETER, LMW |
| Speed Range | 450-750 | 350 (uniform) |
| Hank Constant | 0.14 | 0.14 |
| Std Efficiency | 85% | 90% |
| Default Waste | 0.85 kg | 0.41 kg |
| Divisor Constant | 1693 | 1693 |
| Std Prodn | 1371.72 | 677.79 |

### VB.NET Analysis (frmFinisherDrawingProduction)

#### Header Fields
| Field | Type | Description |
|-------|------|-------------|
| Date | Date | Production date (DD-MMM-YY format) |
| Shift | Integer (1-3) | Production shift |
| Supervisor | Foreign Key | Reference to supervisors table |
| Maisitry | Foreign Key | Reference to supervisors table (optional, NIL allowed) |

#### Production Entry Tab Fields (Per Machine Row)
| Column | Type | Description | Source/Calculation |
|--------|------|-------------|-------------------|
| Mc No. | String | Machine number (FD4-FD10) | Master data |
| Emp. Name | String | Employee name | Manual entry |
| Mixing | String | Production mixing/count | Manual entry |
| Act.Hank | Decimal | Actual hank produced | EL Measure device |
| Act. Prodn | Decimal | Actual production (Kg) | Prod Hank × Constant |
| Exp. Prodn | Decimal | Expected production | Std Prodn × (RunTime/510) |
| Waste | Decimal | Waste amount (Kg) | Manual entry |
| Waste% | Decimal | Waste percentage | (Waste/Act.Prodn) × 100 |
| Act.Effi. | Decimal | Actual efficiency % | (Act.Prodn/Exp.Prodn) × 100 |
| Uti | Decimal | Utilization % | (RunTime/510) × 100 |
| Run Time | Integer | Machine run time (mins) | 510 - Total Stoppage |
| WorkTime | Integer | Work/shift time (mins) | Always 510 |

#### Stoppage Entry Tab Fields
| Column | Type | Description |
|--------|------|-------------|
| Mcno | String | Machine number |
| session | Integer | Session number |
| Effi | Decimal | Efficiency % |
| R.Time | Integer | Run time |
| Stoppage 1 | String | First stoppage reason |
| S.Time 1 | Integer | First stoppage time (mins) |
| Stoppage 2 | String | Second stoppage reason |
| S.Time 2 | Integer | Second stoppage time (mins) |
| Stoppage 3 | String | Third stoppage reason |
| S.Time 3 | Integer | Third stoppage time (mins) |
| Stoppage 4 | String | Fourth stoppage reason |
| S.Time 4 | Integer | Fourth stoppage time (mins) |

#### Machine Setup Tab Fields
| Column | Type | Description |
|--------|------|-------------|
| Mc. No. | String | Machine number |
| Make Name | String | Machine manufacturer (RIETER/LMW) |
| Mixing | String | Count/mixing type |
| Session | Integer | Session number |
| Shift Time | Integer | Total shift time (510) |
| Std. Prodn | Decimal | Standard production (677.79) |
| Speed | Integer | Machine speed (350) |
| Std.Effi. | Integer | Standard efficiency (90%) |
| Sl.Hank | Decimal | Sliver hank (0.14) |
| Deliver | Integer | Delivery count (1) |
| TYPE | String | Machine type (FINISHER) |

### Sample Data (From VB6 Screenshot - 25-Dec-2025, Shift 1)

#### Production Entry Data
| Mc No. | Emp. Name | Mixing | Act.Hank | Act.Prodn | Exp.Prodn | Waste | Waste% | Act.Effi | Uti | RunTime | WorkTime |
|--------|-----------|--------|----------|-----------|-----------|-------|--------|----------|-----|---------|----------|
| FD4 | JAYACHITRA. E | 64COMBED GOLD | 138.63 | 449.19 | 451.86 | 0.41 | 0.09 | 99.41 | 66.67 | 510 | 340 |
| FD5 | JAYACHITRA. E | 64COMBED GOLD | 149.46 | 484.27 | 478.44 | 0.41 | 0.08 | 101.22 | 70.59 | 510 | 360 |
| FD6 | KANAGAVALLI R | 64COMBED GOLD | 99.76 | 323.23 | 318.96 | 0.41 | 0.13 | 101.34 | 47.06 | 510 | 240 |
| FD7 | KANAGAVALLI R | 64COMBED GOLD | 104.54 | 338.72 | 345.54 | 0.41 | 0.12 | 98.03 | 50.98 | 510 | 260 |
| FD8 | KANAGAVALLI R | 64COMBED GOLD | 106.68 | 345.66 | 345.54 | 0.41 | 0.12 | 100.03 | 50.98 | 510 | 260 |
| FD9 | JAYACHITRA. E | 64COMBED GOLD | 99.48 | 322.33 | 318.96 | 0.41 | 0.13 | 101.06 | 47.06 | 510 | 240 |
| FD10 | GANDHIMATHI K | 64COMBED GOLD | 115.24 | 373.39 | 385.41 | 0.82 | 0.22 | 96.88 | 56.86 | 510 | 290 |

#### Stoppage Entry Data
| Mcno | Session | Effi | R.Time | Stoppage1 | S.Time1 | Stoppage2 | S.Time2 | Stoppage3 | S.Time3 |
|------|---------|------|--------|-----------|---------|-----------|---------|-----------|---------|
| FD4 | 1 | 99.41 | 510 | EXCESS STOCK-->ECI | 150 | AIR CLEANING-->AIC | 20 | - | 0 |
| FD5 | 1 | 101.22 | 510 | EXCESS STOCK-->ECI | 130 | AIR CLEANING-->AIC | 20 | - | 0 |
| FD6 | 1 | 101.34 | 510 | EXCESS STOCK-->ECI | 230 | AIR CLEANING-->AIC | 20 | COTS BUFFING-->CBG | 20 |
| FD7 | 1 | 98.03 | 510 | EXCESS STOCK-->ECI | 210 | AIR CLEANING-->AIC | 20 | COTS BUFFING-->CBG | 20 |
| FD8 | 1 | 100.03 | 510 | EXCESS STOCK-->ECI | 210 | AIR CLEANING-->AIC | 20 | COTS BUFFING-->CBG | 20 |
| FD9 | 1 | 101.06 | 510 | EXCESS STOCK-->ECI | 230 | AIR CLEANING-->AIC | 20 | COTS BUFFING-->CBG | 20 |
| FD10 | 1 | 96.88 | 510 | EXCESS STOCK-->ECI | 160 | AIR CLEANING-->AIC | 20 | COTS BUFFING-->CBG | 40 |

#### Machine Setup Data
| Mc.No. | Make | Mixing | Session | ShiftTime | Std.Prodn | Speed | Std.Effi | Sl.Hank | Deliver | TYPE |
|--------|------|--------|---------|-----------|-----------|-------|----------|---------|---------|------|
| FD4 | RIETER | 64COMBED GOLD | 1 | 510 | 677.79 | 350 | 90 | 0.14 | 1 | FINISHER |
| FD5 | RIETER | 64COMBED GOLD | 1 | 510 | 677.79 | 350 | 90 | 0.14 | 1 | FINISHER |
| FD6 | LMW | 64COMBED GOLD | 1 | 510 | 677.79 | 350 | 90 | 0.14 | 1 | FINISHER |
| FD7 | LMW | 64COMBED GOLD | 1 | 510 | 677.79 | 350 | 90 | 0.14 | 1 | FINISHER |
| FD8 | LMW | 64COMBED GOLD | 1 | 510 | 677.79 | 350 | 90 | 0.14 | 1 | FINISHER |
| FD9 | LMW | 64COMBED GOLD | 1 | 510 | 677.79 | 350 | 90 | 0.14 | 1 | FINISHER |
| FD10 | LMW | 64COMBED GOLD | 1 | 510 | 677.79 | 350 | 90 | 0.14 | 1 | FINISHER |

### Calculation Formulas

#### Constants
```
Hank = 0.14
Constant = 1 / 2.20456 / 0.14 ≈ 3.240
Shift Time = 510 mins
Speed = 350 m/min
Std Efficiency = 90%
Divisor Constant = 1693
```

#### Actual Production (Act Prodn)
```
Act Prodn (Kg) = Prod Hank × Constant
```

#### Run Time (From Stoppage)
```
Run Time = Shift Time - Total Stoppage Time
Example FD4: Run Time = 510 - 170 = 340 mins
```

#### Utilization (UTI %)
```
UTI (%) = (Run Time / Shift Time) × 100
Example FD4: = (340 / 510) × 100 = 66.67%
```

#### Standard Production (Std Prodn)
```
Std Prodn (Kg) = Speed / Divisor / Hank × Shift Time × Std Effi
             = 350 / 1693 / 0.14 × 510 × 0.90
             = 677.79 Kg
```

#### Expected Production (Exp Prodn)
```
Exp Prodn = Std Prodn × (Run Time / Shift Time)
Example FD4: = 677.79 × (340 / 510) = 451.86 Kg
```

#### Actual Efficiency (Act Effi %)
```
Act Effi (%) = (Act Prodn / Exp Prodn) × 100
Example FD4: = (449.19 / 451.86) × 100 = 99.41%
```

#### Waste Percentage
```
Waste % = (Waste / Act Prodn) × 100
Example FD4: = (0.41 / 449.19) × 100 = 0.09%
```

### Database Schema

#### Table: drawing_finisher_machines (Master)
```sql
CREATE TABLE drawing_finisher_machines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  machine_no VARCHAR(10) NOT NULL UNIQUE,
  description VARCHAR(100),
  make_name VARCHAR(50),          -- RIETER, LMW
  model VARCHAR(50),
  speed INTEGER DEFAULT 350,
  is_active BOOLEAN DEFAULT true,
  mc_id INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### Table: finisher_drawing_production_header
```sql
CREATE TABLE finisher_drawing_production_header (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_id SERIAL,
  entry_date DATE NOT NULL,
  shift INTEGER NOT NULL CHECK (shift IN (1, 2, 3)),
  supervisor_id UUID REFERENCES supervisors(id),
  maisitry_id UUID REFERENCES supervisors(id),
  total_time INTEGER DEFAULT 510,
  remarks TEXT,
  is_locked BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(entry_date, shift)
);
```

#### Table: finisher_drawing_production_detail
```sql
CREATE TABLE finisher_drawing_production_detail (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  header_id UUID NOT NULL REFERENCES finisher_drawing_production_header(id) ON DELETE CASCADE,
  machine_id UUID NOT NULL REFERENCES drawing_finisher_machines(id),
  employee_name VARCHAR(100),
  prodn_mixing VARCHAR(50),
  act_hank DECIMAL(10,2),
  act_prodn DECIMAL(10,2),
  std_prodn DECIMAL(10,2),
  exp_prodn DECIMAL(10,2),
  effi_percent DECIMAL(5,2),
  uti_percent DECIMAL(5,2),
  waste DECIMAL(10,4) DEFAULT 0.41,
  waste_percent DECIMAL(5,2),
  work_time INTEGER DEFAULT 510,
  run_time INTEGER DEFAULT 510,
  session_no INTEGER DEFAULT 1,
  is_locked BOOLEAN DEFAULT false,
  remarks TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### Table: finisher_drawing_stoppage_entry
```sql
CREATE TABLE finisher_drawing_stoppage_entry (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  production_detail_id UUID NOT NULL REFERENCES finisher_drawing_production_detail(id) ON DELETE CASCADE,
  stoppage1_id UUID REFERENCES stoppage_details(id),
  stoppage1_time INTEGER DEFAULT 0,
  stoppage2_id UUID REFERENCES stoppage_details(id),
  stoppage2_time INTEGER DEFAULT 0,
  stoppage3_id UUID REFERENCES stoppage_details(id),
  stoppage3_time INTEGER DEFAULT 0,
  stoppage4_id UUID REFERENCES stoppage_details(id),
  stoppage4_time INTEGER DEFAULT 0,
  total_stoppage_time INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### Table: finisher_drawing_machine_setup
```sql
CREATE TABLE finisher_drawing_machine_setup (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  machine_id UUID NOT NULL REFERENCES drawing_finisher_machines(id),
  speed INTEGER DEFAULT 350,
  hank_constant DECIMAL(10,4) DEFAULT 0.14,
  std_efficiency_factor DECIMAL(5,4) DEFAULT 0.90,
  default_waste DECIMAL(10,4) DEFAULT 0.41,
  std_prodn DECIMAL(10,2) DEFAULT 677.79,
  shift_time INTEGER DEFAULT 510,
  default_stoppage INTEGER DEFAULT 0,
  divisor_constant INTEGER DEFAULT 1693,
  delivery INTEGER DEFAULT 1,
  make_name VARCHAR(50),
  machine_type VARCHAR(20) DEFAULT 'FINISHER',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Finisher Drawing-Specific Stoppage Reasons
| Code | Stoppage Name | Short Code |
|------|---------------|------------|
| 1530 | EXCESS STOCK | ECI |
| 1531 | AIR CLEANING | AIC |
| 1532 | COTS BUFFING | CBG |
| 1533 | COILER PROBLEM | CLP |
| 1534 | SUCTION PROBLEM | SP |
| 1535 | MATERIAL SHORTAGE | MS |

### Implementation Files (To Be Created)
- `schema/finisher-drawing-entry-setup.sql` - Standalone SQL with all 4 tables and sample data
- `src/lib/supabase/finisherDrawingEntryQueries.js` - CRUD operations
- `src/app/preparatory-entry/finisher-drawing/page.jsx` - Entry page with 3 tabs
- `src/components/modules/preparatory-entry/FinisherDrawingProductionTab.jsx`
- `src/components/modules/preparatory-entry/FinisherDrawingStoppageTab.jsx`
- `src/components/modules/preparatory-entry/FinisherDrawingMachineSetupTab.jsx`

### UI Features (To Be Implemented)
1. **Production Entry Tab**
   - Date picker, Shift dropdown, Supervisor/Maisitry dropdowns
   - Grid with 12 columns (matching VB6 layout)
   - Auto-calculation on stoppage changes
   - "EL Measure Data" button for device input (Act.Hank, Act.Prodn)
   - "Calculator" button
   - "Update" and "Cancel" buttons

2. **Stoppage Entry Tab**
   - Grid with stoppage reasons and times (up to 4 per machine)
   - "Full Stoppage" section (applies stoppage to all machines)
   - "Partial Stoppage" section (from/to machine range)
   - "Apply" buttons for both stoppage types

3. **Machine Setup Tab**
   - Configure calculation constants per machine
   - Speed (350), Hank (0.14), Efficiency (90%), Delivery (1)
   - Make Name (RIETER/LMW), Machine Type (FINISHER)
   - "Count change", "Add new machine", "Remove machine" buttons

---

## Notes
- User: PROD (Production user role visible in screenshots)
- Entry Level: Group level access control
- Date Format: DD-MMM-YYYY HH:MM:SS (05-May-2025 12:00:18 PM)
- All master modules follow similar CRUD pattern
- Search functionality is standard across all modules

---

## Complexity Assessment
**Overall Difficulty:** ⭐⭐ (Easy to Medium)

**Reasons:**
1. Repetitive CRUD patterns
2. Simple form validations
3. Standard master data management
4. No complex business logic visible yet
5. Clear UI/UX patterns

**Estimated Timeline:** 2-3 months for complete system

---

## Module 20: Comber Entry (Preparatory Entry)
### Status: ⏳ Not Started
### Related: Module 12 (Comber Machine Master)

### Overview
Comber Entry is a production data entry module for Comber machines (CO1-CO12). It follows the same 3-tab pattern as other preparatory entry modules but has a unique feature: **manual Run Hours input (HH.MM format)** which is converted to Run Minutes for calculations.

### Key Differences from Other Modules
| Aspect | Comber Entry | Breaker/Finisher Drawing | Lap Former |
|--------|--------------|-------------------------|------------|
| Machines | CO1-CO12 (12) | BD1-BD8, FD4-FD10 | LF1-LF4 |
| Run Time Input | Manual HH.MM (RunHrs) | Calculated from Stoppage | Calculated from Stoppage |
| Run Min Calc | Hours×60 + (Decimal×100) | ShiftTime - Stoppage | ShiftTime - Stoppage |
| Std.hrs Calc | WorkTime × MCEffi% | Speed-based | Speed-based |
| Efficiency Factor | 93% | 90% | 85% |
| Hank | 0.14 | 0.14 | 0.14 |
| Production Unit | Kg (via Constant) | Kg (via Constant) | Kg (via Constant) |

### VB.NET Analysis

#### frmcomberEntryNew.frm - Main Form Structure
```vb
' Form has 3 tabs: Production Entry, Stoppage Entry, Machine Setup
' Production Tab: MSFlexGrid (MSHFGrid1) with 13 columns
' Stoppage Tab: MSFlexGrid (MSHFGrid2) with 9 columns (4 stoppage slots)
' Machine Setup Tab: MSFlexGrid (MSHFGrid3) with 6 columns
```

#### Header Fields (Production Entry)
| Field | Type | Description |
|-------|------|-------------|
| Date | Date Picker | Entry date (DD-MMM-YYYY) |
| Shift | Dropdown | 1, 2, 3 |
| Supervisor | Dropdown | From supervisors master |
| Maisitry | Dropdown | From supervisors master (optional, can be NIL) |

#### Grid Columns - Production Entry Tab
| # | Column Name | Type | Editable | Description |
|---|-------------|------|----------|-------------|
| 1 | Mc No. | Text | No | Machine number (CO1-CO12) |
| 2 | EmpName | Dropdown | Yes | Employee name |
| 3 | Count | Text | No | Mixing/Count from setup (e.g., 64COMBED GOLD) |
| 4 | Act.Hank | Decimal | Yes | Actual Hank production (manual input) |
| 5 | RunHrs | Decimal | Yes | Run Hours in HH.MM format (e.g., 5.58 = 5hr 58min) |
| 6 | RunMin | Integer | Calc | Calculated: Hours×60 + Minutes |
| 7 | Waste | Decimal | Yes | Waste in Kg (default 0.96 or 0.97) |
| 8 | Act.Prodn | Decimal | Calc | Actual Production = Act.Hank × Constant |
| 9 | Waste% | Decimal | Calc | Waste Percentage = (Waste / Act.Prodn) × 100 |
| 10 | Act.Effi | Decimal | Calc | Actual Efficiency % |
| 11 | Uti | Decimal | Calc | Utilization % = (WorkTime / TotalTime) × 100 |
| 12 | Std.hrs | Decimal | Calc | Standard Hours = WorkTime × MCEffi / 100 |
| 13 | WorkTime | Integer | Calc | Total Time - Total Stoppage |

#### Grid Columns - Stoppage Entry Tab
| # | Column Name | Type | Editable | Description |
|---|-------------|------|----------|-------------|
| 1 | Mcno | Text | No | Machine number |
| 2 | session | Integer | No | Session number (always 1) |
| 3 | ActEffi | Decimal | No | Actual Efficiency (read from production) |
| 4 | R.Time | Integer | No | Total shift time (510 mins) |
| 5 | Stoppage 1 | Dropdown | Yes | Stoppage reason (e.g., NIPPER CLEANING-->NI) |
| 6 | S.Time 1 | Integer | Yes | Stoppage time in minutes |
| 7 | Stoppage 2 | Dropdown | Yes | Stoppage reason 2 |
| 8 | S.Time 2 | Integer | Yes | Stoppage time 2 |
| 9 | Stoppage 3 | Dropdown | Yes | Stoppage reason 3 |
| 10 | S.Time 3 | Integer | Yes | Stoppage time 3 |
| 11 | Stoppage 4 | Dropdown | Yes | Stoppage reason 4 |
| 12 | S.Time 4 | Integer | Yes | Stoppage time 4 |

#### Grid Columns - Machine Setup Tab
| # | Column Name | Type | Editable | Description |
|---|-------------|------|----------|-------------|
| 1 | Mc. No. | Text | No | Machine number |
| 2 | Count | Dropdown | Yes | Mixing/Count selection |
| 3 | Session | Integer | Yes | Session number (default 1) |
| 4 | C. C. Time | Integer | Yes | Can Change Time (default 0) |
| 5 | Sl.Hank | Decimal | Yes | Sliver Hank (default 0.14) |
| 6 | MCEffi | Integer | Yes | Machine Efficiency % (default 93) |

### Sample Data - Production Entry
| Mc No | EmpName | Count | Act.Hank | RunHrs | RunMin | Waste | Act.Prodn | Waste% | Act.Effi | Uti | Std.hrs | WorkTime |
|-------|---------|-------|----------|--------|--------|-------|-----------|--------|----------|------|---------|----------|
| CO1 | PAVITHRA P | 64COMBED GOLD | 21.61 | 1.56 | 116 | 0.96 | 70.02 | 1.37 | 83.15 | 29.41 | 139.5 | 150 |
| CO2 | PAVITHRA P | 64COMBED GOLD | 71.56 | 5.58 | 358 | 0.41 | 231.86 | 0.41 | 91.65 | 82.35 | 390.6 | 420 |
| CO3 | PAVITHRA P | 64COMBED GOLD | 59.45 | 5.24 | 324 | 0.96 | 192.63 | 0.50 | 89.33 | 76.47 | 362.7 | 390 |
| CO4 | MUTHULAKSHMI K | 64COMBED GOLD | 51.14 | 4.41 | 281 | 0.97 | 165.70 | 0.59 | 91.56 | 64.71 | 306.9 | 330 |
| CO5 | MUTHULAKSHMI K | 64COMBED GOLD | 61.26 | 6.01 | 361 | 0.97 | 198.49 | 0.49 | 92.42 | 82.35 | 390.6 | 420 |
| CO6 | MUTHULAKSHMI K | 64COMBED GOLD | 87.34 | 6.07 | 367 | 0.97 | 282.99 | 0.34 | 96.25 | 80.39 | 381.3 | 410 |
| CO7 | MUTHULAKSHMI K | 64COMBED GOLD | 70.10 | 5.46 | 346 | 0.97 | 227.13 | 0.43 | 88.58 | 82.35 | 390.6 | 420 |
| CO8 | MUTHULAKSHMI K | 64COMBED GOLD | 83.62 | 6.31 | 391 | 0.97 | 270.94 | 0.36 | 100.10 | 82.35 | 390.6 | 420 |
| CO9 | MUTHULAKSHMI K | 64COMBED GOLD | 61.35 | 5.54 | 354 | 0.97 | 198.78 | 0.49 | 90.63 | 82.35 | 390.6 | 420 |
| CO10 | PAVITHRA P | 64COMBED GOLD | 59.92 | 5.55 | 355 | 0.96 | 194.15 | 0.49 | 100.45 | 74.51 | 353.4 | 380 |
| CO11 | PAVITHRA P | 64COMBED GOLD | 88.67 | 6.45 | 405 | 0.96 | 287.30 | 0.33 | 103.69 | 82.35 | 390.6 | 420 |
| CO12 | PAVITHRA P | 64COMBED GOLD | 90.03 | 6.48 | 408 | 0.96 | 291.71 | 0.33 | 104.45 | 82.35 | 390.6 | 420 |

### Sample Data - Stoppage Entry
| Mcno | session | ActEffi | R.Time | Stoppage 1 | S.Time 1 | Stoppage 2 | S.Time 2 | Stoppage 3 | S.Time 3 | Stoppage 4 | S.Time 4 |
|------|---------|---------|--------|------------|----------|------------|----------|------------|----------|------------|----------|
| CO1 | 1 | 83.15 | 510 | NIPPER CLEANING-->NI | 15 | COTS CLEANING-->COT | 15 | VXL CLEANING-->VXL | 330 | - | 0 |
| CO2 | 1 | 91.65 | 510 | NIPPER CLEANING-->NI | 15 | COTS CLEANING-->COT | 15 | VXL CLEANING-->VXL | 60 | - | 0 |
| CO3 | 1 | 89.33 | 510 | NIPPER CLEANING-->NI | 15 | COTS CLEANING-->COT | 15 | VXL CLEANING-->VXL | 90 | - | 0 |

### Sample Data - Machine Setup
| Mc. No. | Count | Session | C. C. Time | Sl.Hank | MCEffi |
|---------|-------|---------|------------|---------|--------|
| CO1 | 64COMBED GOLD | 1 | 0 | 0.14 | 93 |
| CO2 | 64COMBED GOLD | 1 | 0 | 0.14 | 93 |
| CO3 | 64COMBED GOLD | 1 | 0 | 0.14 | 93 |
| ... | 64COMBED GOLD | 1 | 0 | 0.14 | 93 |
| CO12 | 64COMBED GOLD | 1 | 0 | 0.14 | 93 |

### Calculation Formulas

#### Constants
```
Hank = 0.14
Constant = 1 / 2.20456 / Hank ≈ 3.240
Shift Time = 510 mins
MC Efficiency = 93%
Session = 1
```

#### Run Minutes Calculation (UNIQUE to Comber)
```
RunHrs is entered as HH.MM format (e.g., 5.58 = 5 hours 58 minutes)
Hours = Integer part of RunHrs (e.g., 5)
Minutes = Decimal part × 100 (e.g., 0.58 × 100 = 58)
RunMin = (Hours × 60) + Minutes

Example CO2: RunHrs = 5.58
  Hours = 5
  Minutes = 58
  RunMin = (5 × 60) + 58 = 358 ✓
```

#### Work Time
```
WorkTime = Total Time - Total Stoppage
Example CO2: WorkTime = 510 - 90 = 420 ✓
```

#### Utilization (UTI %)
```
UTI (%) = (WorkTime / TotalTime) × 100
Example CO2: = (420 / 510) × 100 = 82.35% ✓
```

#### Standard Hours (Std.hrs)
```
Std.hrs = WorkTime × (MCEffi / 100)
Example CO2: = 420 × 0.93 = 390.6 ✓
```

#### Actual Production (Act.Prodn)
```
Act.Prodn (Kg) = Act.Hank × Constant
Constant = 1 / 2.20456 / 0.14 ≈ 3.240
Example CO2: = 71.56 × 3.24 = 231.86 ✓
```

#### Waste Percentage (Waste%)
```
Waste% = (Waste / Act.Prodn) × 100
Example CO1: = (0.96 / 70.02) × 100 = 1.37% ✓
```

#### Actual Efficiency (Act.Effi %)
```
Expected Hank = Std.hrs × Rate
where Rate = derived from machine constants
Act.Effi (%) = (Act.Hank / Expected Hank) × 100

Alternative calculation (verified):
Act.Effi (%) = (RunMin / Std.hrs) × 100
Example CO2: = (358 / 390.6) × 100 = 91.65% ✓
```

### Comber-Specific Stoppage Reasons
| Code | Stoppage Name | Short Code |
|------|---------------|------------|
| 1201 | NIPPER CLEANING | NI |
| 1202 | COTS CLEANING | COT |
| 1203 | VXL CLEANING | VXL |
| 1204 | TOP COMB CLEANING | TCC |
| 1205 | NOIL DRUM CLEANING | NDC |
| 1206 | LAP BREAKAGE | LB |
| 1207 | SLIVER BREAKAGE | SB |
| 1208 | MECHANICAL FAULT | MF |
| 1209 | ELECTRICAL FAULT | EF |
| 1210 | NO LAP | NL |

### Database Schema

#### Table: comber_machines (Master - Already exists in Module 12)
```sql
-- Reference to existing comber_machines table
-- machine_no: CO1-CO12
-- is_active: true/false
```

#### Table: comber_production_header
```sql
CREATE TABLE comber_production_header (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_id SERIAL,
  entry_date DATE NOT NULL,
  shift INTEGER NOT NULL CHECK (shift IN (1, 2, 3)),
  supervisor_id UUID REFERENCES supervisors(id),
  maisitry_id UUID REFERENCES supervisors(id),
  total_time INTEGER DEFAULT 510,
  remarks TEXT,
  is_locked BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(entry_date, shift)
);
```

#### Table: comber_production_detail
```sql
CREATE TABLE comber_production_detail (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  header_id UUID NOT NULL REFERENCES comber_production_header(id) ON DELETE CASCADE,
  machine_id UUID NOT NULL REFERENCES comber_machines(id),
  employee_name VARCHAR(100),
  prodn_mixing VARCHAR(50),
  act_hank DECIMAL(10,2),
  run_hrs DECIMAL(5,2),              -- HH.MM format input
  run_min INTEGER,                    -- Calculated: Hours*60 + Minutes
  waste DECIMAL(10,4) DEFAULT 0.96,
  act_prodn DECIMAL(10,2),            -- Calculated: Act.Hank × Constant
  waste_percent DECIMAL(5,2),         -- Calculated: (Waste/Act.Prodn)*100
  act_effi_percent DECIMAL(5,2),      -- Calculated: (RunMin/Std.hrs)*100
  uti_percent DECIMAL(5,2),           -- Calculated: (WorkTime/TotalTime)*100
  std_hrs DECIMAL(10,2),              -- Calculated: WorkTime × MCEffi/100
  work_time INTEGER DEFAULT 510,      -- Calculated: TotalTime - TotalStoppage
  session_no INTEGER DEFAULT 1,
  is_locked BOOLEAN DEFAULT false,
  remarks TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### Table: comber_stoppage_entry
```sql
CREATE TABLE comber_stoppage_entry (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  production_detail_id UUID NOT NULL REFERENCES comber_production_detail(id) ON DELETE CASCADE,
  stoppage1_id UUID REFERENCES stoppage_details(id),
  stoppage1_time INTEGER DEFAULT 0,
  stoppage2_id UUID REFERENCES stoppage_details(id),
  stoppage2_time INTEGER DEFAULT 0,
  stoppage3_id UUID REFERENCES stoppage_details(id),
  stoppage3_time INTEGER DEFAULT 0,
  stoppage4_id UUID REFERENCES stoppage_details(id),
  stoppage4_time INTEGER DEFAULT 0,
  total_stoppage_time INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### Table: comber_machine_setup
```sql
CREATE TABLE comber_machine_setup (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  machine_id UUID NOT NULL REFERENCES comber_machines(id),
  prodn_mixing VARCHAR(50),           -- Count/Mixing selection
  session_no INTEGER DEFAULT 1,
  cc_time INTEGER DEFAULT 0,          -- Can Change Time
  sl_hank DECIMAL(10,4) DEFAULT 0.14, -- Sliver Hank
  mc_effi INTEGER DEFAULT 93,         -- Machine Efficiency %
  shift_time INTEGER DEFAULT 510,
  default_waste DECIMAL(10,4) DEFAULT 0.96,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Implementation Files (To Be Created)
- `schema/comber-entry-setup.sql` - Standalone SQL with all tables and sample data
- `src/lib/supabase/comberEntryQueries.js` - CRUD operations
- `src/app/preparatory-entry/comber/page.jsx` - Entry page with 3 tabs
- `src/components/modules/preparatory-entry/ComberProductionTab.jsx`
- `src/components/modules/preparatory-entry/ComberStoppageTab.jsx`
- `src/components/modules/preparatory-entry/ComberMachineSetupTab.jsx`

### UI Features (To Be Implemented)
1. **Production Entry Tab**
   - Date picker, Shift dropdown, Supervisor/Maisitry dropdowns
   - Grid with 13 columns (Mc No, EmpName, Count, Act.Hank, RunHrs, RunMin, Waste, Act.Prodn, Waste%, Act.Effi, Uti, Std.hrs, WorkTime)
   - **RunHrs input field** (HH.MM format) - unique to Comber
   - Auto-calculation on input changes
   - "Update" and "Cancel" buttons

2. **Stoppage Entry Tab**
   - Grid with stoppage reasons and times (up to 4 per machine)
   - "Full Stoppage" section (applies stoppage to all machines)
   - "Partial Stoppage" section (from/to machine range)
   - "Apply" buttons for both stoppage types
   - **Recalculates WorkTime and Std.hrs on stoppage change**

3. **Machine Setup Tab**
   - Configure calculation constants per machine
   - Count/Mixing selection dropdown
   - Session (default 1), C.C. Time (default 0)
   - Sl.Hank (default 0.14), MCEffi (default 93%)
   - "Count change", "Add new machine", "Remove machine" buttons

### Special Implementation Notes
1. **RunHrs to RunMin Conversion**: Must implement HH.MM parsing
   - 5.58 → 5 hours, 58 minutes → 358 minutes
   - NOT 5.58 × 60 = 334.8 (wrong!)
2. **Efficiency Calculation**: Uses RunMin/Std.hrs × 100 (different from other modules)
3. **Default Waste Values**: 0.96 for PAVITHRA P, 0.97 for MUTHULAKSHMI K (employee-specific?)
4. **Copy Previous Data**: Should copy all production, stoppage, and machine setup data

---

## Module 21: Simplex Entry (Preparatory Entry)
### Status: ⏳ Not Started
### Related: Module 14 (Simplex Machine Master)

### Overview
Simplex Entry is a production data entry module for Simplex/Speed Frame machines (Machine 1-10). It follows the same 3-tab pattern as other preparatory entry modules but has a unique feature: **Idle Spindles** input which affects the Active Spindles used in production calculation.

### Key Differences from Other Modules
| Aspect | Simplex Entry | Comber Entry | Breaker/Finisher Drawing |
|--------|---------------|--------------|--------------------------|
| Machines | 1-10 (10) | CO1-CO12 (12) | BD1-BD8, FD4-FD10 |
| Run Time Input | Manual HH.MM (RunHrs) | Manual HH.MM (RunHrs) | Calculated from Stoppage |
| Run Min Calc | Hours×60 + (Decimal×100) | Hours×60 + (Decimal×100) | ShiftTime - Stoppage |
| Std.hrs Calc | WorkTime × MCEffi% | WorkTime × MCEffi% | Speed-based |
| Efficiency Factor | 92% | 93% | 90% |
| **Idle Spindles** | ✅ (NEW!) | ❌ | ❌ |
| TPI | ✅ (varies 1.66-1.73) | ❌ | ❌ |
| Spindles | ✅ (120/140) | ❌ | ❌ |
| Hank | 1.4 (Sl.Hank) | 0.14 | 0.14 |
| Production Unit | Kg | Kg | Kg |

### VB.NET Analysis

#### frmSimplexEntry.frm - Main Form Structure
```vb
' Form has 3 tabs: Production Entry, Stoppage Entry, Machine Setup
' Production Tab: MSFlexGrid (MSHFGrid1) with 13 columns
' Stoppage Tab: MSFlexGrid (MSHFGrid2) with 9+ columns (4 stoppage slots)
' Machine Setup Tab: MSFlexGrid (MSHFGrid3) with 8 columns
' Date: 22-Apr-25, Shift: 1, Supervisor: LOGAMMAL G, Maisitry: NIL
```

#### Header Fields (Production Entry)
| Field | Type | Description |
|-------|------|-------------|
| Date | Date Picker | Entry date (DD-MMM-YYYY) |
| Shift | Dropdown | 1, 2, 3 |
| Supervisor | Dropdown | From supervisors master |
| Maisitry | Dropdown | From supervisors master (optional, can be NIL) |

#### Grid Columns - Production Entry Tab (13 columns)
| # | Column Name | Type | Editable | Description |
|---|-------------|------|----------|-------------|
| 1 | Mc No. | Text | No | Machine number (1-10) |
| 2 | EmpName | Dropdown | Yes | Employee name |
| 3 | Count | Text | No | Mixing/Count from setup (e.g., 64COMBED GOLD) |
| 4 | RunHrs | Decimal | Yes | Run Hours in HH.MM format (e.g., 7.12 = 7hr 12min) |
| 5 | RunMin | Integer | Calc | Calculated: Hours×60 + Minutes |
| 6 | **Idle Spl** | Integer | Yes | Idle Spindles (0, 1, 2...) - **UNIQUE to Simplex** |
| 7 | Waste | Decimal | Yes | Waste in Kg (default varies 0.8-0.95) |
| 8 | Act.Prodn | Decimal | Calc | Actual Production in Kg |
| 9 | Waste% | Decimal | Calc | Waste Percentage = (Waste / Act.Prodn) × 100 |
| 10 | Act.Effi | Decimal | Calc | Actual Efficiency % |
| 11 | Uti | Decimal | Calc | Utilization % = (WorkTime / TotalTime) × 100 |
| 12 | Std.hrs | Decimal | Calc | Standard Hours = WorkTime × MCEffi / 100 |
| 13 | WorkTime | Integer | Calc | Total Time - Total Stoppage |

#### Grid Columns - Stoppage Entry Tab
| # | Column Name | Type | Editable | Description |
|---|-------------|------|----------|-------------|
| 1 | Mcno | Text | No | Machine number |
| 2 | session | Integer | No | Session number (always 1) |
| 3 | ActEffi | Decimal | No | Actual Efficiency (read from production) |
| 4 | R.Time | Integer | No | Total shift time (510 mins) |
| 5 | Stoppage 1 | Dropdown | Yes | Stoppage reason |
| 6 | S.Time 1 | Integer | Yes | Stoppage time in minutes |
| 7 | Stoppage 2 | Dropdown | Yes | Stoppage reason 2 |
| 8 | S.Time 2 | Integer | Yes | Stoppage time 2 |
| 9 | Stoppage 3 | Dropdown | Yes | Stoppage reason 3 |
| 10 | S.Time 3 | Integer | Yes | Stoppage time 3 |
| 11 | Stoppage 4 | Dropdown | Yes | Stoppage reason 4 |
| 12 | S.Time 4 | Integer | Yes | Stoppage time 4 |

#### Grid Columns - Machine Setup Tab (8 columns)
| # | Column Name | Type | Editable | Description |
|---|-------------|------|----------|-------------|
| 1 | Mc. No. | Text | No | Machine number |
| 2 | Count | Dropdown | Yes | Mixing/Count selection |
| 3 | Session | Integer | Yes | Session number (default 1) |
| 4 | C. C. Time | Integer | Yes | Can Change Time (default 0) |
| 5 | Sl.Hank | Decimal | Yes | Sliver Hank (default 1.4) |
| 6 | MCEffi | Integer | Yes | Machine Efficiency % (default 92) |
| 7 | TPI | Decimal | Yes | TPI value (1.66, 1.69, 1.73) |
| 8 | Spindle | Integer | Yes | Number of spindles (120/140) |

### Sample Data - Production Entry (Date: 22-Apr-25, Shift: 1)
| Mc No | EmpName | Count | RunHrs | RunMin | Idle Spl | Waste | Act.Prodn | Waste% | Act.Effi | Uti | Std.hrs | WorkTime |
|-------|---------|-------|--------|--------|----------|-------|-----------|--------|----------|------|---------|----------|
| 1 | KARPAGAVALLI K | 64COMBED GOLD | 7.12 | 432 | 0 | 0.9 | 389.55 | 0.23 | 97.83 | 94.12 | 441.6 | 480 |
| 2 | KARPAGAVALLI K | 64COMBED GOLD | 7.02 | 422 | 0 | 0.9 | 380.53 | 0.24 | 95.56 | 94.12 | 441.6 | 480 |
| 3 | MAHESHWARI T | 64COMBED GOLD | 7.05 | 425 | 0 | 0.87 | 383.23 | 0.23 | 96.24 | 94.12 | 441.6 | 480 |
| 4 | AMUDHA V | 64COMBED GOLD | 6.26 | 386 | 0 | 0.8 | 293.22 | 0.27 | 97.98 | 94.12 | 370.8 | 403 |
| 5 | AMUDHA V | 64COMBED GOLD | 6.26 | 386 | 0 | 0.8 | 329.3 | 0.24 | 85.45 | 94.12 | 438.8 | 477 |
| 6 | DHANALAKSHMI R | 64COMBED GOLD | 6.48 | 408 | 0 | 0.85 | 340.97 | 0.25 | 103.47 | 94.12 | 370.8 | 403 |
| 7 | ESAKKISELVI S | 64COMBED GOLD | 6.41 | 401 | 0 | 0.9 | 305.89 | 0.29 | 93.79 | 95.1 | 426.6 | 464 |
| 8 | ESAKKISELVI S | 64COMBED GOLD | 6.07 | 367 | 0 | 0.85 | 280 | 0.30 | 85.96 | 95.1 | 426.6 | 464 |
| 9 | ESAKKISELVI S | 64COMBED GOLD | 6.29 | 389 | **1** | 0.95 | 298.16 | 0.32 | 87.18 | 95.1 | 446.2 | 485 |
| 10 | SAGUNTHALA V | 64COMBED GOLD | 7.2 | 440 | **2** | 0.8 | 332.82 | 0.24 | 93.78 | 100 | 469.2 | 510 |

**Key Observation:** Machine 9 has 1 Idle Spindle, Machine 10 has 2 Idle Spindles - these reduce the Active Spindles in the production calculation formula.

### Sample Data - Stoppage Entry
| Mcno | session | ActEffi | R.Time | Stoppage 1 | S.Time 1 | Stoppage 2 | S.Time 2 | Stoppage 3 | S.Time 3 | Stoppage 4 | S.Time 4 |
|------|---------|---------|--------|------------|----------|------------|----------|------------|----------|------------|----------|
| 1 | 1 | 97.83 | 510 | EXCESS STOCK-->EIU | 30 | - | 0 | - | 0 | - | 0 |
| 2 | 1 | 95.56 | 510 | EXCESS STOCK-->EIU | 30 | - | 0 | - | 0 | - | 0 |
| 3 | 1 | 96.24 | 510 | EXCESS STOCK-->EIU | 30 | - | 0 | - | 0 | - | 0 |
| 4 | 1 | 97.98 | 510 | QAD WORK-->QW | 107 | - | 0 | - | 0 | - | 0 |
| 5 | 1 | 85.45 | 510 | EXCESS STOCK-->EIU | 33 | - | 0 | - | 0 | - | 0 |
| 6 | 1 | 103.47 | 510 | FLYER GREASING-->fg | 77 | EXCESS STOCK-->EIU | 30 | - | 0 | - | 0 |
| 7 | 1 | 93.79 | 510 | FLYER GREASING-->fg | 21 | IDLE CHECKING-->IDE | 25 | - | 0 | - | 0 |
| 8 | 1 | 85.96 | 510 | FLYER GREASING-->fg | 21 | IDLE CHECKING-->IDE | 25 | - | 0 | - | 0 |
| 9 | 1 | 87.18 | 510 | IDLE CHECKING-->IDE | 25 | - | 0 | - | 0 | - | 0 |
| 10 | 1 | 93.78 | 510 | - | 0 | - | 0 | - | 0 | - | 0 |

### Sample Data - Machine Setup
| Mc. No. | Count | Session | C. C. Time | Sl.Hank | MCEffi | TPI | Spindle |
|---------|-------|---------|------------|---------|--------|-----|---------|
| 1 | 64COMBED GOLD | 1 | 0 | 1.4 | 92 | 1.73 | 140 |
| 2 | 64COMBED GOLD | 1 | 0 | 1.4 | 92 | 1.73 | 140 |
| 3 | 64COMBED GOLD | 1 | 0 | 1.4 | 92 | 1.73 | 140 |
| 4 | 64COMBED GOLD | 1 | 0 | 1.4 | 92 | 1.73 | 120 |
| 5 | 64COMBED GOLD | 1 | 0 | 1.4 | 92 | 1.73 | 140 |
| 6 | 64COMBED GOLD | 1 | 0 | 1.4 | 92 | 1.73 | 120 |
| 7 | 64COMBED GOLD | 1 | 0 | 1.4 | 92 | 1.69 | 120 |
| 8 | 64COMBED GOLD | 1 | 0 | 1.4 | 92 | 1.69 | 120 |
| 9 | 64COMBED GOLD | 1 | 0 | 1.4 | 92 | 1.73 | 140 |
| 10 | 64COMBED GOLD | 1 | 0 | 1.44 | 92 | 1.69 | 120 |

### Calculation Formulas

#### Constants (from Machine Setup)
```
Speed = varies by machine (960-1050 from master)
TPI = varies (1.66, 1.69, 1.73)
Hank = 1.4 (Sl.Hank)
MCEffi = 92%
Total Spindles = 120 or 140
Divisor = 39.3 × 1693 = 66,536.9
Shift Time = 510 mins
```

#### Run Minutes Calculation (Same as Comber)
```
RunHrs is entered as HH.MM format (e.g., 7.12 = 7 hours 12 minutes)
Hours = Integer part of RunHrs (e.g., 7)
Minutes = Decimal part × 100 (e.g., 0.12 × 100 = 12)
RunMin = (Hours × 60) + Minutes

Example Machine 1: RunHrs = 7.12
  Hours = 7
  Minutes = 12
  RunMin = (7 × 60) + 12 = 432 ✓
```

#### Work Time
```
WorkTime = Total Time - Total Stoppage
Example Machine 1: WorkTime = 510 - 30 = 480 ✓
Example Machine 4: WorkTime = 510 - 107 = 403 ✓
```

#### Utilization (UTI %)
```
UTI (%) = (WorkTime / TotalTime) × 100
Example Machine 1: = (480 / 510) × 100 = 94.12% ✓
Example Machine 10: = (510 / 510) × 100 = 100% ✓
```

#### Standard Hours (Std.hrs)
```
Std.hrs = WorkTime × (MCEffi / 100)
Example Machine 1: = 480 × 0.92 = 441.6 ✓
Example Machine 10: = 510 × 0.92 = 469.2 ✓
```

#### Active Spindles (UNIQUE to Simplex)
```
Active Spindles = Total Spindles - Idle Spindles

Example Machine 1: Active = 140 - 0 = 140
Example Machine 9: Active = 140 - 1 = 139
Example Machine 10: Active = 120 - 2 = 118
```

#### Actual Production (Act.Prodn) - SIMPLEX FORMULA
```
Act.Prodn (Kg) = (Speed / TPI / 39.3 / 1693 / Hank) × RunMin × Active Spindles

Example Machine 1 (Speed=1040 from master, all spindles active):
  Act.Prodn = (1040 / 1.73 / 39.3 / 1693 / 1.4) × 432 × 140
  Act.Prodn = 0.000645 × 432 × 140 = 389.55 Kg ✓

Example Machine 9 (Speed=1040, 1 idle spindle):
  Active Spindles = 140 - 1 = 139
  Act.Prodn = (1040 / 1.73 / 39.3 / 1693 / 1.4) × 389 × 139
  Act.Prodn = 0.000645 × 389 × 139 = 298.16 Kg ✓

Example Machine 10 (Speed=960, 2 idle spindles):
  Active Spindles = 120 - 2 = 118
  Act.Prodn = (960 / 1.69 / 39.3 / 1693 / 1.44) × 440 × 118
  Act.Prodn = 0.000639 × 440 × 118 = 332.82 Kg ✓
```

#### Waste Percentage (Waste%)
```
Waste% = (Waste / Act.Prodn) × 100
Example Machine 1: = (0.9 / 389.55) × 100 = 0.23% ✓
Example Machine 9: = (0.95 / 298.16) × 100 = 0.32% ✓
```

#### Actual Efficiency (Act.Effi %)
```
Act.Effi (%) = (RunMin / Std.hrs) × 100
Example Machine 1: = (432 / 441.6) × 100 = 97.83% ✓
Example Machine 6: = (408 / 370.8) × 100 = 103.47% ✓ (over 100% is possible)
Example Machine 10: = (440 / 469.2) × 100 = 93.78% ✓
```

### Simplex-Specific Stoppage Reasons
| Code | Stoppage Name | Short Code |
|------|---------------|------------|
| 1301 | EXCESS STOCK | EIU |
| 1302 | QAD WORK | QW |
| 1303 | FLYER GREASING | fg |
| 1304 | IDLE CHECKING | IDE |
| 1305 | BOBBIN DOFF | BD |
| 1306 | CREEL CHANGE | CC |
| 1307 | SLIVER BREAKAGE | SB |
| 1308 | MECHANICAL FAULT | MF |
| 1309 | ELECTRICAL FAULT | EF |
| 1310 | NO MATERIAL | NM |

### Database Schema

#### Table: simplex_machines (Master - Already exists in Module 14)
```sql
-- Reference to existing simplex_machines table
-- machine_no: 1-10 (integer style)
-- includes: mc_effi, tpi, no_of_spindles (unique fields)
-- is_active: true/false
```

#### Table: simplex_production_header
```sql
CREATE TABLE simplex_production_header (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_id SERIAL,
  entry_date DATE NOT NULL,
  shift INTEGER NOT NULL CHECK (shift IN (1, 2, 3)),
  supervisor_id UUID REFERENCES supervisors(id),
  maisitry_id UUID REFERENCES supervisors(id),
  total_time INTEGER DEFAULT 510,
  remarks TEXT,
  is_locked BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(entry_date, shift)
);
```

#### Table: simplex_production_detail
```sql
CREATE TABLE simplex_production_detail (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  header_id UUID NOT NULL REFERENCES simplex_production_header(id) ON DELETE CASCADE,
  machine_id UUID NOT NULL REFERENCES simplex_machines(id),
  employee_name VARCHAR(100),
  prodn_mixing VARCHAR(50),
  run_hrs DECIMAL(5,2),              -- HH.MM format input (e.g., 7.12 = 7hr 12min)
  run_min INTEGER,                    -- Calculated: Hours×60 + Minutes
  idle_spindles INTEGER DEFAULT 0,    -- NEW: Idle spindles count
  waste DECIMAL(10,4) DEFAULT 0.9,
  act_prodn DECIMAL(10,2),            -- Calculated: Simplex formula with active spindles
  waste_percent DECIMAL(5,2),         -- Calculated: (Waste/Act.Prodn)*100
  act_effi_percent DECIMAL(5,2),      -- Calculated: (RunMin/Std.hrs)*100
  uti_percent DECIMAL(5,2),           -- Calculated: (WorkTime/TotalTime)*100
  std_hrs DECIMAL(10,2),              -- Calculated: WorkTime × MCEffi/100
  work_time INTEGER DEFAULT 510,      -- Calculated: TotalTime - TotalStoppage
  session_no INTEGER DEFAULT 1,
  is_locked BOOLEAN DEFAULT false,
  remarks TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### Table: simplex_stoppage_entry
```sql
CREATE TABLE simplex_stoppage_entry (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  production_detail_id UUID NOT NULL REFERENCES simplex_production_detail(id) ON DELETE CASCADE,
  stoppage1_id UUID REFERENCES stoppage_details(id),
  stoppage1_time INTEGER DEFAULT 0,
  stoppage2_id UUID REFERENCES stoppage_details(id),
  stoppage2_time INTEGER DEFAULT 0,
  stoppage3_id UUID REFERENCES stoppage_details(id),
  stoppage3_time INTEGER DEFAULT 0,
  stoppage4_id UUID REFERENCES stoppage_details(id),
  stoppage4_time INTEGER DEFAULT 0,
  total_stoppage_time INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### Table: simplex_machine_setup
```sql
CREATE TABLE simplex_machine_setup (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  machine_id UUID NOT NULL REFERENCES simplex_machines(id),
  prodn_mixing VARCHAR(50),           -- Count/Mixing selection
  session_no INTEGER DEFAULT 1,
  cc_time INTEGER DEFAULT 0,          -- Can Change Time
  sl_hank DECIMAL(10,4) DEFAULT 1.4,  -- Sliver Hank (1.4, not 0.14!)
  mc_effi INTEGER DEFAULT 92,         -- Machine Efficiency % (92, not 93!)
  tpi DECIMAL(5,2) DEFAULT 1.73,      -- TPI value (unique to Simplex)
  spindles INTEGER DEFAULT 140,        -- Number of spindles (unique to Simplex)
  shift_time INTEGER DEFAULT 510,
  default_waste DECIMAL(10,4) DEFAULT 0.9,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Implementation Files (To Be Created)
- `schema/simplex-entry-setup.sql` - Standalone SQL with all tables and sample data
- `src/lib/supabase/simplexEntryQueries.js` - CRUD operations
- `src/app/preparatory-entry/simplex/page.jsx` - Entry page with 3 tabs
- `src/components/modules/preparatory-entry/SimplexProductionTab.jsx`
- `src/components/modules/preparatory-entry/SimplexStoppageTab.jsx`
- `src/components/modules/preparatory-entry/SimplexMachineSetupTab.jsx`

### UI Features (To Be Implemented)
1. **Production Entry Tab**
   - Date picker, Shift dropdown, Supervisor/Maisitry dropdowns
   - Grid with 13 columns (Mc No, EmpName, Count, RunHrs, RunMin, **Idle Spl**, Waste, Act.Prodn, Waste%, Act.Effi, Uti, Std.hrs, WorkTime)
   - **RunHrs input field** (HH.MM format) - same as Comber
   - **Idle Spl input field** - UNIQUE to Simplex
   - Auto-calculation on input changes (with Active Spindles logic)
   - "Update" and "Cancel" buttons

2. **Stoppage Entry Tab**
   - Grid with stoppage reasons and times (up to 4 per machine)
   - "Full Stoppage" section (applies stoppage to all machines)
   - "Partial Stoppage" section (from/to machine range)
   - "Apply" buttons for both stoppage types
   - **Recalculates WorkTime and Std.hrs on stoppage change**

3. **Machine Setup Tab**
   - Configure calculation constants per machine
   - Count/Mixing selection dropdown
   - Session (default 1), C.C. Time (default 0)
   - Sl.Hank (default 1.4), MCEffi (default 92%)
   - **TPI** (1.66, 1.69, 1.73) - UNIQUE to Simplex
   - **Spindles** (120/140) - UNIQUE to Simplex
   - "Count change", "Add new machine", "Remove machine" buttons

### Special Implementation Notes
1. **RunHrs to RunMin Conversion**: Same as Comber - HH.MM parsing
   - 7.12 → 7 hours, 12 minutes → 432 minutes
   - NOT 7.12 × 60 = 427.2 (wrong!)
2. **Idle Spindles**: Must deduct from total spindles before production calculation
   - Active Spindles = Total Spindles - Idle Spindles
3. **Production Formula**: Complex formula using Speed, TPI, Hank, RunMin, Active Spindles
   - Act.Prodn = (Speed / TPI / 39.3 / 1693 / Hank) × RunMin × Active Spindles
4. **Efficiency Over 100%**: Possible when RunMin > Std.hrs (see Machine 6: 103.47%)
5. **Hank Difference**: Uses 1.4 (not 0.14 like other modules)
6. **Copy Previous Data**: Should copy all production, stoppage, and machine setup data

---

# POST PREPARATORY ENTRY MODULES

> **Post Preparatory** refers to the final stages of yarn production after preparatory processes (Carding, Drawing, Combing, Simplex). This section includes:
> 1. **Spinning (ACL/Ring Frame)** - Ring frame production entry

---

## Module 22: Spinning Production Entry (Post Preparatory)

### Module Category: Post Preparatory Entry
### Sub-Module: 1. Spinning (ACL / Ring Frame)

### Status: DOCUMENTED ✅ (January 14, 2026)

### Overview
The Spinning Production Entry module is part of the **"Post Preparatory Entry"** section. It manages production data entry for Ring Frame (RF) machines with three tabs:
1. **Production Entry** - Per machine production data with calculated fields (GPS, Waste%, W.Spls)
2. **Stoppage Entry** - Machine stoppage tracking (up to 4 stoppages) with GPS/Exp.GPS
3. **Machine Setup** - Configuration for calculation constants (TPI, TW.Con, Spindles, etc.)

### Route Structure
```
/post-preparatory
└── /spinning          → Spinning Production Entry (Module 22)
    ├── Production Entry Tab
    ├── Stoppage Entry Tab
    └── Machine Setup Tab
```

### Important Rule
> 👉 **Nothing is fetched from machine automatically**
> 👉 **All base values are manual or master-data fetched**
> 👉 **Remaining are pure formulas**

### VB.NET Analysis (From Screenshots - Smart Spin Lite)

#### Header Fields
| Field | Type | Description |
|-------|------|-------------|
| Date | DATE | Entry date (e.g., 22-Apr-25, 1/6/2026) |
| Shift | INTEGER | Shift number (1, 2, 3) |
| Supervisor | DROPDOWN | Supervisor name (e.g., BALASUBRAMANIAN.S, SUBRAMANIAN.A) |
| Maisitry | DROPDOWN | Maisitry name (e.g., SENTHOORPANDI.S, PREMANAYAGAM.M, NIL) |

---

### TAB 1: Production Entry

#### Production Entry Grid Columns (8 columns - from screenshot)
| Column | Database Field | Description | Source |
|--------|----------------|-------------|--------|
| Frame No. | frame_no | Machine Number (RF1-RF47) | spinning_machines |
| Count Name | count_name | Count/Mixing (68 COMBED STAR, COMBED COMPACT) | Machine Setup |
| Act. Hank | act_hank | Actual Hank | ✍️ Manual Entry |
| Act. Prodn | act_prodn | Actual Production (Kg) | 📐 Calculated |
| Waste | waste | Waste in kg | ✍️ Manual Entry |
| Waste % | waste_percent | Waste Percentage | 📐 Calculated |
| G.P.S | gps | Grams Per Spindle (Actual) | 📐 Calculated |
| W. Spls | worked_spindles | Worked Spindles | 📐 Calculated |
| Exp. GPS | exp_gps | Expected GPS | 📐 Calculated |

#### Sample Production Data (From Screenshot - 1/6/2026, Shift 1)
| Frame No | Count Name | Act Hank | Act Prodn | Waste | Waste% | G.P.S | W.Spls | Exp GPS |
|----------|------------|----------|-----------|-------|--------|-------|--------|---------|
| RF46 | COMBED STAR | 4.11 | 28.33 | 0.1 | 0.35 | 47.37 | 598 | 50.173 |
| RF47 | COMBED STAR | 9.08 | 62.55 | 0.26 | 0.42 | 53.32 | 1173 | 51.283 |
| RF1A | COMBED COMPACT | 12.75 | 169.25 | 0.9 | 0.53 | 87.33 | 1938 | 93.622 |
| RF2A | COMBED COMPACT | 12.93 | 171.65 | 0.9 | 0.52 | 88.57 | 1938 | 93.622 |
| RF3A | COMBED COMPACT | 12.58 | 167.03 | 0.85 | 0.51 | 86.19 | 1938 | 93.622 |
| RF4A | COMBED COMPACT | 12.8 | 170.02 | 0.8 | 0.47 | 87.73 | 1938 | 93.622 |
| RF5A | COMBED STAR | 11.58 | 136.18 | 0.7 | 0.51 | 73.44 | 1854.4 | 77.898 |
| RF6A | COMBED STAR | 11.65 | 136.94 | 0.76 | 0.55 | 70.66 | 1938 | 77.857 |
| RF7A | COMBED STAR | 11.66 | 137.12 | 0.7 | 0.51 | **70.75** | 1938 | 77.882 |
| RF8A | COMBED STAR | 10.59 | 124.5 | 0.67 | 0.54 | 67.55 | 1843 | 77.225 |
| RF9A | COMBED STAR | 11.4 | 134.1 | 0.65 | 0.48 | 70.02 | 1915.2 | 76.097 |
| RF10A | COMBED STAR | 11.47 | 134.88 | 0.7 | 0.52 | 69.6 | 1938 | 75.885 |
| RF11A | COMBED STAR | 11.2 | 131.77 | 0.61 | 0.46 | 67.99 | 1938 | 74.904 |
| RF12A | COMBED STAR | 5.99 | 70.55 | 0.25 | 0.35 | 54.61 | 1292 | 68.794 |
| RF13A | COMBED STAR | 9.97 | 117.3 | 0.55 | 0.47 | 63 | 1862 | 65.993 |
| RF14A | COMBED STAR | 8.36 | 98.42 | 0.4 | 0.41 | 53.18 | 1850.6 | 56.094 |
| RF15A | COMBED STAR | 6.36 | 74.91 | 0.27 | 0.36 | 40.15 | 1865.8 | 41.627 |

---

### TAB 2: Stoppage Entry

#### Stoppage Entry Grid Columns (10+ columns - from screenshot)
| Column | Database Field | Description | Source |
|--------|----------------|-------------|--------|
| Mc.No | machine_no | Machine Number (RF1-RF15) | spinning_machines |
| Count | count_name | Count Name (68 COMBED STAR) | Machine Setup |
| Session | session_no | Session Number (default 1) | 🔹 Stored |
| R.Time | run_time | Run Time (default **510 mins**) | 🔹 Stored |
| GPS | gps | Actual GPS | 📐 Formula |
| EXP.GP | exp_gps | Expected GPS | 📐 Formula |
| Stoppage 1 | stoppage1_id | First Stoppage Reason (e.g., TRAVELLER CHANGE) | ✍️ Manual |
| S.Time 1 | stoppage1_time | First Stoppage Time (mins) | ✍️ Manual |
| Stoppage 2 | stoppage2_id | Second Stoppage Reason (e.g., COMPRESSOR TRIP) | ✍️ Manual |
| S.Time 2 | stoppage2_time | Second Stoppage Time (mins) | ✍️ Manual |
| Stoppage 3 | stoppage3_id | Third Stoppage Reason | ✍️ Manual |
| S.Time 3 | stoppage3_time | Third Stoppage Time | ✍️ Manual |
| Stoppage 4 | stoppage4_id | Fourth Stoppage Reason | ✍️ Manual |
| S.Time 4 | stoppage4_time | Fourth Stoppage Time | ✍️ Manual |

#### Sample Stoppage Data (From Screenshot - 22-Apr-25)
| Mc.No | Count | Session | R.Time | GPS | EXP.GP | Stoppage 1 | S.Time 1 | Stoppage 2 | S.Time 2 |
|-------|-------|---------|--------|-----|--------|------------|----------|------------|----------|
| RF1 | 68 COMBED STAR | 1 | 510 | 59.91 | 59.581 | - | 0 | - | 0 |
| RF2 | 68 COMBED STAR | 1 | 510 | **54.5** | 59.418 | TRAVELLER CHANGE... | 16 | COMPRESSOR TRIP... | - |
| RF3 | 68 COMBED STAR | 1 | 510 | **57.87** | 58.303 | - | 0 | - | 0 |
| RF4 | 68 COMBED STAR | 1 | 510 | 59.2 | 58.438 | - | 0 | - | 0 |
| RF5 | 68 COMBED STAR | 1 | 510 | 59.87 | 58.226 | - | 0 | - | 0 |
| RF6 | 68 COMBED STAR | 1 | 510 | 60.1 | 57.712 | - | 0 | - | 0 |
| RF7 | 68 COMBED STAR | 1 | 510 | **58.85** | 59.141 | - | 0 | - | 0 |
| RF8 | 68 COMBED STAR | 1 | 510 | 58.94 | 58.524 | - | 0 | - | 0 |
| RF9 | 68 COMBED STAR | 1 | 510 | 59.16 | 56.886 | - | 0 | - | 0 |
| RF10 | 68 COMBED STAR | 1 | 510 | 59.7 | 57.077 | - | 0 | - | 0 |
| RF11 | 68 COMBED STAR | 1 | 510 | 58.1 | 57.191 | - | 0 | - | 0 |
| RF12 | 68 COMBED STAR | 1 | 510 | **57.97** | 59.849 | - | 0 | - | 0 |

**Note:** Values highlighted in **red** (shown in screenshots) indicate GPS values below expected threshold.

#### Stoppage Entry Features (From Screenshot)
- **Full Stoppage Section**: Apply stoppage to all machines at once
  - Stoppage dropdown
  - Stoppage [HH:MM] input
  - Apply button
- **Partial Stoppage Section**: Apply to machine range
  - From M/c No. dropdown
  - To M/c No. dropdown
  - Stoppage dropdown
  - Stoppage [HH:MM] input
  - Apply button

---

### TAB 3: Machine Setup

#### Machine Setup Grid Columns (11 columns - from screenshot)
| Column | Database Field | Description | Source |
|--------|----------------|-------------|--------|
| McNo | machine_no | Machine Number (RF1, RF2, etc.) | 🔹 Stored |
| MakeName | make_name | Manufacturer (LMW) | 🔹 Stored |
| CountName | count_name | Count Name (68 COMBED STAR) | 🔹 Stored |
| Act.Count | act_count | Actual Count (default **69.5**) | 🔹 Stored |
| *I (TPI) | tpi | Twist Per Inch (e.g., 13) | ✍️ Manual |
| Allocated Spls | allocated_spindles | Allocated Spindles (1104) | ✍️ Manual |
| TW.Con | tw_con | Twist Constant (4) | 🔹 Stored |
| DoffLoss | doff_loss | Doff Loss (0.7) | 🔹 Stored |
| C.Waste% | c_waste_percent | Cotton Waste % (0.9) | 🔹 Stored |
| Speed | speed | Machine Speed | ✍️ Manual |
| Session | session_no | Session Number (default 1) | 🔹 Stored |
| Run Time | run_time | Run Time (**510 mins**) | 🔹 Stored |

#### Sample Machine Setup Data (From Screenshot - 07-Jan-26, Shift 3)
| McNo | MakeName | CountName | Act.Count | *I | Allocated Spls | TW.Con | DoffLoss | C.Waste% |
|------|----------|-----------|-----------|-----|----------------|--------|----------|----------|
| RF1 | LMW | 68 COMBED STAR | 69.5 | 13 | 1104 | 4 | 0.7 | 0.9 |
| RF2 | LMW | 68 COMBED STAR | 69.5 | 13 | 1104 | 4 | 0.7 | 0.9 |
| RF3 | LMW | 68 COMBED STAR | 69.5 | 95 | 1104 | 4 | 0.7 | 0.9 |
| RF4 | LMW | 68 COMBED STAR | 69.5 | 13 | 1104 | 4 | 0.7 | 0.9 |
| RF5 | LMW | 68 COMBED STAR | 69.5 | 13 | 1104 | 4 | 0.7 | 0.9 |
| RF6 | LMW | 68 COMBED STAR | 69.5 | 13 | 1104 | 4 | 0.7 | 0.9 |
| RF35 | LMW | 68 COMBED STAR | 69.5 | 13 | 1104 | 4 | 0.7 | 0.9 |
| RF36 | LMW | 68 COMBED STAR | 69.5 | 13 | 1104 | 4 | 0.7 | 0.9 |
| RF37 | LMW | 68 COMBED STAR | 69.5 | 13 | 1104 | 4 | 0.7 | 0.9 |
| RF38 | LMW | 68 COMBED STAR | 69.5 | 13 | 1104 | 4 | 0.7 | 0.9 |
| RF39 | LMW | 68 COMBED STAR | 69.5 | 13 | 1104 | 4 | 0.7 | 0.9 |
| RF40 | LMW | 68 COMBED STAR | 69.5 | 13 | 1104 | 4 | 0.7 | 0.9 |
| RF41 | LMW | 68 COMBED STAR | 69.5 | 13 | 1104 | 4 | 0.7 | 0.9 |

#### Machine Setup Buttons
- **Count change** - Change count for selected machines
- **Add new machine** - Add a new machine
- **Remove machine** - Remove selected machine
- **Speed**, **TPI**, **T.C**, **Count** checkboxes for bulk updates

---

## 🔢 SPINNING FORMULAS (VERIFIED & LOCKED ✅)

### Constants
| Constant | Value | Description |
|----------|-------|-------------|
| Conversion Factor | 2.20456 | Kg to Lbs conversion |
| Efficiency (Effi) | 0.985 (98.5%) | Standard efficiency |
| Default Run Time | 510 mins | Total shift time |
| Default Spindles | 1104 | Standard spindle count |

---

### 🔹 A. CONSTANT (ACL)

```
Constant = (1 / 2.20456 / ACL_Count) × Total_Spl × Effi
```

**Where:**
- ACL_Count = Count (e.g., 68)
- Effi = **98.5% → 0.985**
- Total_Spl = from Machine Setup (e.g., 1104)

**Example:**
```
Constant = (1 / 2.20456 / 68) × 1104 × 0.985
         = 0.00667 × 1104 × 0.985
         ≈ 7.26
```

---

### 🔹 B. ACL PRODUCTION (Kg)

```
ACL_Prod = ACL_Hank × Constant
```

**Example:**
```
ACL_Prod = 10.19 × 6.897 ≈ 70.27 kg
```

✔ Matches screen behaviour
✔ Explains Act Prodn column correctly

---

### 🔹 C. WASTE %

```
Waste % = (Waste / ACL_Prod) × 100
```

**Example:**
```
Waste % = (0.22 / 70.27) × 100 ≈ 0.31%
```

✔ Screen logic is correct

---

### 🔹 D. STOPPED SPINDLES

```
Stopped_Spl = (Stoppage_Mins / Total_Mins) × Total_Spl
```

**Example:**
- Total mins = 510
- Stoppage = 30 mins
- Total Spl = 1104

```
Stopped_Spl = (30 / 510) × 1104 = 64.94 ≈ 65
```

---

### 🔹 E. WORKED SPINDLES

```
Worked_Spl = Total_Spl − Stopped_Spl
```

**Example:**
```
Worked_Spl = 1104 − 65 = 1039
```

✔ This fixes earlier confusion
✔ This is **NOT manual** - it's calculated

---

### 🔹 F. GPS (Actual)

```
GPS = (ACL_Prod / Worked_Spl) × 1000
```

**Example:**
```
GPS = (70.27 / 1104) × 1000 ≈ 63.65
```

✔ Matches production screen
✔ Explains why GPS changes when stoppage changes

---

### 🔹 G. EXPECTED GPS

```
Exp_GPS = (Constant × Act_Hank / Worked_Spl) × 1000
```

**Or simplified:**
```
Exp_GPS = (ACL_Prod / Worked_Spl) × 1000  (when efficiency = 100%)
```

✔ Same formula used in Production Entry and Stoppage Entry

---

## Complete Calculation Example

**Given Values:**
| Field | Value |
|-------|-------|
| Act Hank | 10.19 |
| Waste | 0.22 |
| Total Spl | 1104 |
| Stoppage | 0 min |
| Effi | 98.5% |
| ACL Count | 68 |

---

### Step 1: Constant
```
Constant = 1 / 2.20456 / 68 × 1104 × 0.985 ≈ 6.897
```

### Step 2: Actual Production
```
ACL_PROD = 10.19 × 6.897 ≈ 70.27 kg
```
✅ **Matches screen: 70.27**

### Step 3: Waste %
```
Waste % = 0.22 / 70.27 × 100 ≈ 0.31 %
```
✅ **Matches screen: 0.31**

### Step 4: Worked Spindles
```
Stopped Spl = (0 / 510) × 1104 = 0
Worked Spl = 1104 − 0 = 1104
```
✅ **Matches screen**

### Step 5: GPS
```
GPS = 70.27 / 1104 × 1000 ≈ 63.65
```
✅ **Matches screen: ~63.65**

### Step 6: Expected GPS
```
Exp GPS ≈ GPS (since no stoppage, Run Time = 510)
≈ 59.58 – 59.9 (rounding variations)
```
✅ **Matches screen: 59.581**

---

## Database Schema

### Table: spinning_production_header
```sql
CREATE TABLE spinning_production_header (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_id SERIAL,
  entry_date DATE NOT NULL,
  shift INTEGER NOT NULL CHECK (shift IN (1, 2, 3)),
  supervisor_id UUID REFERENCES supervisors(id),
  maisitry_id UUID REFERENCES supervisors(id),
  total_time INTEGER DEFAULT 510,
  remarks TEXT,
  is_locked BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(entry_date, shift)
);
```

### Table: spinning_production_detail
```sql
CREATE TABLE spinning_production_detail (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  header_id UUID NOT NULL REFERENCES spinning_production_header(id) ON DELETE CASCADE,
  machine_id UUID NOT NULL REFERENCES spinning_machines(id),
  count_name VARCHAR(100),
  act_hank DECIMAL(10,2),               -- Manual Entry
  act_prodn DECIMAL(10,2),              -- Calculated: act_hank × constant
  waste DECIMAL(10,4) DEFAULT 0.1,      -- Manual Entry
  waste_percent DECIMAL(5,2),           -- Calculated: (waste/act_prodn)*100
  gps DECIMAL(10,2),                    -- Calculated: (act_prodn/worked_spl)*1000
  worked_spindles DECIMAL(10,2),        -- Calculated: total_spl - stopped_spl
  exp_gps DECIMAL(10,2),                -- Calculated: expected GPS
  session_no INTEGER DEFAULT 1,
  is_verified BOOLEAN DEFAULT false,
  verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Table: spinning_stoppage_entry
```sql
CREATE TABLE spinning_stoppage_entry (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  production_detail_id UUID NOT NULL REFERENCES spinning_production_detail(id) ON DELETE CASCADE,
  run_time INTEGER DEFAULT 510,
  stoppage1_id UUID REFERENCES stoppage_details(id),
  stoppage1_time INTEGER DEFAULT 0,
  stoppage2_id UUID REFERENCES stoppage_details(id),
  stoppage2_time INTEGER DEFAULT 0,
  stoppage3_id UUID REFERENCES stoppage_details(id),
  stoppage3_time INTEGER DEFAULT 0,
  stoppage4_id UUID REFERENCES stoppage_details(id),
  stoppage4_time INTEGER DEFAULT 0,
  total_stoppage_time INTEGER DEFAULT 0,  -- Calculated: sum of all stoppage times
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Table: spinning_machine_setup
```sql
CREATE TABLE spinning_machine_setup (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  machine_id UUID NOT NULL REFERENCES spinning_machines(id),
  count_name VARCHAR(100),
  act_count DECIMAL(10,2) DEFAULT 69.5,
  tpi DECIMAL(5,2) DEFAULT 13,            -- Twist Per Inch
  allocated_spindles INTEGER DEFAULT 1104,
  tw_con INTEGER DEFAULT 4,               -- Twist Constant
  doff_loss DECIMAL(5,2) DEFAULT 0.7,
  c_waste_percent DECIMAL(5,2) DEFAULT 0.9,
  speed INTEGER,
  session_no INTEGER DEFAULT 1,
  run_time INTEGER DEFAULT 510,
  efficiency DECIMAL(5,3) DEFAULT 0.985,  -- 98.5%
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(machine_id)
);
```

---

## Implementation Files (To Be Created)

### Backend (API Routes)
- `src/app/api/post-preparatory/spinning/route.js` - CRUD for spinning production
- `src/app/api/post-preparatory/spinning/[id]/route.js` - Single entry operations
- `src/lib/supabase/spinningEntryQueries.js` - Database queries

### Frontend Pages
- `src/app/post-preparatory/spinning/page.jsx` - Main entry page with 3 tabs

### Components
- `src/components/modules/post-preparatory/SpinningProductionTab.jsx`
- `src/components/modules/post-preparatory/SpinningStoppageTab.jsx`
- `src/components/modules/post-preparatory/SpinningMachineSetupTab.jsx`
- `src/components/modules/post-preparatory/SpinningCalculations.js` - Formula logic

---

## UI Features (To Be Implemented)

### 1. Production Entry Tab
- Date picker, Shift dropdown, Supervisor/Maisitry dropdowns
- Grid with 9 columns (Frame No, Count Name, Act Hank, Act Prodn, Waste, Waste%, GPS, W.Spls, Exp GPS)
- **Act Hank** and **Waste** are manual input fields
- Auto-calculation on input changes (GPS, Waste%, Worked Spindles)
- "Update" and "Cancel" buttons
- "Machine Data" section for quick reference
- "Calculator" button for manual calculations
- "Attach" button for file attachments

### 2. Stoppage Entry Tab
- Grid with machine info and stoppage columns (up to 4 stoppages per machine)
- GPS and EXP.GP columns showing calculated values
- **Full Stoppage Section**: Apply stoppage to all machines
  - Stoppage dropdown
  - Stoppage [HH:MM] input
  - Apply button
- **Partial Stoppage Section**: Apply to machine range
  - From M/c No. dropdown
  - To M/c No. dropdown
  - Stoppage dropdown
  - Stoppage [HH:MM] input
  - Apply button
- **Recalculates Worked Spindles and GPS on stoppage change**

### 3. Machine Setup Tab
- Configure calculation constants per machine
- McNo, MakeName, CountName (from master)
- Act.Count (default 69.5)
- TPI input (e.g., 13)
- Allocated Spindles (default 1104)
- TW.Con (default 4), DoffLoss (default 0.7), C.Waste% (default 0.9)
- Speed input
- Session (default 1), Run Time (default 510)
- Checkboxes for bulk updates (Speed, TPI, T.C, Count)
- "Count change", "Add new machine", "Remove machine" buttons

---

## Special Implementation Notes

1. **No Machine Data Fetching**: All values are manually entered or from master data - nothing automatic from machines
2. **Constant Calculation**: Must use the exact formula with 2.20456 conversion factor
3. **Stoppage Impact**: Stoppage directly affects Worked Spindles → affects GPS
4. **GPS Highlighting**: Values below expected should be highlighted in red
5. **Run Time Default**: Always 510 minutes per shift
6. **Efficiency**: Fixed at 98.5% (0.985) for all calculations
7. **Copy Previous Data**: Should copy all production, stoppage, and machine setup data from previous entry

---

## Module 23: Autoconer Production Entry (Post Preparatory)

### Module Category: Post Preparatory Entry
### Sub-Module: 2. Autoconer Production

### Status: DOCUMENTED ✅ (January 16, 2026)

### Overview
The Autoconer Production Entry module manages production data entry for Autoconer winding machines. Autoconers wind yarn from ring frame bobbins onto cones. The module has three tabs:
1. **Production Entry** - Per machine production data with drum efficiency and waste tracking
2. **Stoppage Entry** - Machine stoppage tracking with Full/Partial stoppage features
3. **Machine Setup** - Configuration for count, efficiency, and run time settings

### Route Structure
```
/post-preparatory
└── /autoconer          → Autoconer Production Entry (Module 23)
    ├── Production Entry Tab
    ├── Stoppage Entry Tab
    └── Machine Setup Tab
```

### VB.NET Analysis (From Screenshots - Smart Spin Lite)

#### Header Fields
| Field | Type | Description |
|-------|------|-------------|
| Date | DATE | Entry date (e.g., 22-Apr-25) |
| Shift | INTEGER | Shift number (1, 2, 3) |
| Supervisor | DROPDOWN | Supervisor name (e.g., BALASUBRAMANIAN.S) |

---

### TAB 1: Production Entry

#### Production Entry Grid Columns (16 columns - from screenshot)
| Column | Database Field | Description | Source |
|--------|----------------|-------------|--------|
| Mc No. | machine_no | Machine Number (AC1-1, AC2-1, etc.) | autoconer_machines |
| Emp. Name | emp_name | Employee Name | ✍️ Manual Entry |
| Count Name | count_name | Count Name (68 COMBED STAR) | Machine Setup |
| Drum From | from_drum | Starting Drum Number | autoconer_machines |
| Drum To | to_drum | Ending Drum Number | autoconer_machines |
| Drum Total | drum_total | Total Drums (no_of_drums) | autoconer_machines |
| Act. Prodn | act_prodn | Actual Production (Kg) | ✍️ Manual Entry |
| Prodn Effi. | prodn_effi | Production Efficiency % | 📐 Calculated |
| Red Light | red_light | Red Light Count | ✍️ Manual Entry |
| Idle Drum | idle_drum | Number of Idle Drums | ✍️ Manual Entry |
| Idle Reason | idle_reason | Reason for Idle Drums | ✍️ Dropdown |
| Act. Effi. | act_effi | Actual Efficiency % | autoconer_machines |
| Waste Kg | waste_kg | Waste in Kg | ✍️ Manual Entry |
| Waste % | waste_percent | Waste Percentage | 📐 Calculated |
| Total Stopp Mins | total_stoppage_mins | Total Stoppage Minutes | 📐 From Stoppage Entry |
| Work Time | work_time | Work Time (510 - Total Stopp Mins) | 📐 Calculated |

#### Sample Production Data (From Screenshot - 22-Apr-25, Shift 1)
| Mc No. | Emp. Name | Count Name | Drum From | Drum To | Drum Total | Act. Prodn | Prodn Effi. | Red Light | Idle Drum | Idle Reason | Act. Effi. | Waste Kg | Waste % |
|--------|-----------|------------|-----------|---------|------------|------------|-------------|-----------|-----------|-------------|------------|----------|---------|
| AC1-1 | MARAGADAM M | 68 COMBED STAR | 1 | 60 | 60 | 215 | 86.2 | 1.6 | 1 | IDLE DRUM--... | 82 | 0 | 0 |
| AC2-1 | CHITHRA S | 68 COMBED STAR | 1 | 30 | 30 | 168 | 84 | 1 | 1 | IDLE DRUM--... | 82 | 0 | 0 |
| AC2-2 | MUTHUMARI K | 68 COMBED STAR | 31 | 60 | 30 | 41 | 84.5 | 0.4 | 1 | IDLE DRUM--... | 82 | 0 | 0 |
| AC3-1 | NIL | 68 COMBED STAR | 1 | 12 | 12 | 0 | 0 | 0 | 0 | | 82 | 0 | 0 |
| AC3-2 | NIL | 68 COMBED STAR | 13 | 24 | 12 | 0 | 0 | 0 | 0 | | 82 | 0 | 0 |
| AC4-1 | NIL | 68 COMBED STAR | 1 | 12 | 12 | 33 | 80 | 0.82 | 1 | IDLE DRUM--... | 82 | 0 | 0 |
| AC4-2 | NIL | 68 COMBED STAR | 13 | 24 | 12 | 39 | 79.6 | 1.01 | 0 | | 82 | 0 | 0 |
| AC5-1 | MARIAMMAL K | 68 COMBED STAR | 1 | 12 | 12 | 44 | 86.5 | 0.68 | 1 | IDLE DRUM--... | 82 | 0 | 0 |
| AC5-2 | MARIAMMAL K | 68 COMBED STAR | 13 | 24 | 12 | 45 | 86.5 | 0.57 | 1 | IDLE DRUM--... | 82 | 0 | 0 |
| AC5-3 | MARIAMMAL K | 68 COMBED STAR | 25 | 36 | 12 | 49 | 86.5 | 1.02 | 0 | | 82 | 0 | 0 |

---

### TAB 2: Stoppage Entry

#### Stoppage Entry Grid Columns (12+ columns - from screenshot)
| Column | Database Field | Description | Source |
|--------|----------------|-------------|--------|
| M/c ID | mc_id | Machine ID Number | autoconer_machines |
| Mc. No. | machine_no | Machine Number | autoconer_machines |
| Count Name | count_name | Count Name | Machine Setup |
| Session | session_no | Session Number (default 1) | 🔹 Stored |
| R. Time | run_time | Run Time (default **510 mins**) | 🔹 Stored |
| Stoppage 1 | stoppage1_id | First Stoppage Reason (e.g., DAILY CLEAN...) | ✍️ Manual |
| S. Time 1 | stoppage1_time | First Stoppage Time (mins) | ✍️ Manual |
| Stoppage 2 | stoppage2_id | Second Stoppage Reason (e.g., BSS-->BS) | ✍️ Manual |
| S. Time 2 | stoppage2_time | Second Stoppage Time (mins) | ✍️ Manual |
| Stoppage 3 | stoppage3_id | Third Stoppage Reason | ✍️ Manual |
| S. Time 3 | stoppage3_time | Third Stoppage Time | ✍️ Manual |
| Stoppage 4 | stoppage4_id | Fourth Stoppage Reason | ✍️ Manual |
| S. Time 4 | stoppage4_time | Fourth Stoppage Time | ✍️ Manual |
| Total Stopp Mins | total_stoppage_time | Total Stoppage (S.Time1 + S.Time2 + S.Time3 + S.Time4) | 📐 Calculated |

#### Sample Stoppage Data (From Screenshot - 22-Apr-25)
| M/c ID | Mc. No. | Count Name | Session | R. Time | Stoppage 1 | S. Time 1 | Stoppage 2 | S. Time 2 | Total Stopp |
|--------|---------|------------|---------|---------|------------|-----------|------------|-----------|-------------|
| 2 | AC1-1 | 68 COMBED... | 1 | 510 | DAILY CLEAN... | 40 | BSS-->BS | 100 | 140 |
| 3 | AC2-1 | 68 COMBED... | 1 | 510 | DAILY CLEAN... | 40 | BSS-->BS | 100 | 140 |
| 4 | AC2-2 | 68 COMBED... | 1 | 510 | DAILY CLEAN... | 40 | BSS-->BS | 100 | 140 |
| 5 | AC3-1 | 68 COMBED... | 1 | 510 | BSS-->BS | 510 | | 0 | 510 |
| 6 | AC3-2 | 68 COMBED... | 1 | 510 | BSS-->BS | 510 | | 0 | 510 |
| 10 | AC4-1 | 68 COMBED... | 1 | 510 | DAILY CLEAN... | 40 | BSS-->BS | 70 | 110 |
| 11 | AC4-2 | 68 COMBED... | 1 | 510 | DAILY CLEAN... | 40 | BSS-->BS | 70 | 110 |

#### Special Stoppage Features
**Full Stoppage Section:**
- Stoppage dropdown
- Stoppage mins input
- "Apply" button → Applies stoppage to ALL machines

**Partial Stoppage Section:**
- Stoppage dropdown
- From Group No. dropdown
- To Group No. dropdown
- Stoppage mins input
- "Apply" button → Applies stoppage to selected group range

---

### TAB 3: Machine Setup

#### Machine Setup Grid Columns (6 columns - from screenshot)
| Column | Database Field | Description | Source |
|--------|----------------|-------------|--------|
| Mc. No. | machine_no | Machine Number (AC1-1, AC2-1, etc.) | autoconer_machines |
| Make Name | make_name | Make Name (MURT) | autoconer_machines |
| Count Name | count_name | Count Name (68 COMBED STAR) | ✍️ Dropdown |
| Act. Count | act_count | Actual Count Value (69.5) | ✍️ Manual Entry |
| Session | session_no | Session Number (default 1) | 🔹 Stored |
| R. Time | run_time | Run Time (default 510) | 🔹 Stored |

#### Sample Machine Setup Data (From Screenshot)
| Mc. No. | Make Name | Count Name | Act. Count | Session | R. Time |
|---------|-----------|------------|------------|---------|---------|
| AC1-1 | MURT | 68 COMBED STAR | 69.5 | 1 | 510 |
| AC2-1 | MURT | 68 COMBED STAR | 69.5 | 1 | 510 |
| AC2-2 | MURT | 68 COMBED STAR | 69.5 | 1 | 510 |
| AC3-1 | MURT | 68 COMBED STAR | 69.5 | 1 | 510 |
| AC4-1 | MURT | 68 COMBED STAR | 69.5 | 1 | 510 |
| AC5-1 | MURT | 68 COMBED STAR | 69.5 | 1 | 510 |

#### Machine Setup Buttons
- **Count Check** - Validate count settings
- **Count Change** - Change count for machines
- **Add New Machine** - Add a new autoconer machine
- **Remove Machine** - Remove/deactivate a machine

---

### Autoconer Formulas

> **Reference:** `formula/autoconer-formula.md`

#### 1. Waste Percentage
```
Waste % = (Waste / Act Prod) × 100
```

#### 2. Utilization Percentage (UTI %)
```
UTI % = (Run Time / Total Time) × 100
```

#### 3. Idle Drum Percentage
```
Idle Drum % = (Idle Drum / Total Drum) × 100
```

#### 4. Adjusted UTI % (considering idle drums)
```
Drum Efficiency = 100 - Idle Drum %
Adjusted UTI % = (Run Time / Total Time) × Drum Efficiency
```

**Example (AC1-1):**
- Idle Drum = 5, Total Drum = 60
- Idle Drum % = (5 / 60) × 100 = 8.33%
- Drum Efficiency = 100 - 8.33 = **91.67%**
- UTI % = (Run Time / Total Time) × 91.67
- If Run Time = 510, Total Time = 510:
- UTI % = (510 / 510) × 91.67 = **91.67%**

---

### Machine Grouping Rules

| Group Type | Machines | Drum Split | No. of Drums |
|------------|----------|------------|--------------|
| 1 Machine | AC1-1, AC14-1 | 1-60 | 60 |
| 2 Machines | AC2, AC9-AC13 | 1-30, 31-60 | 30 each |
| 5 Machines | AC3-AC8 | 1-12, 13-24, 25-36, 37-48, 49-60 | 12 each |

---

### Database Schema (Autoconer)

#### Table: autoconer_machines
```sql
CREATE TABLE autoconer_machines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  machine_no TEXT NOT NULL UNIQUE,
  description TEXT NOT NULL,
  make_name TEXT DEFAULT 'MURT',
  act_effi INTEGER DEFAULT 80,
  is_active BOOLEAN DEFAULT true,
  mc_id INTEGER UNIQUE,
  group_id INTEGER DEFAULT 1,
  model TEXT,
  from_drum INTEGER,
  to_drum INTEGER,
  no_of_drums INTEGER DEFAULT 0,
  speed INTEGER,
  count TEXT,
  installed_date DATE,
  direct_prod_entry BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### Table: autoconer_production_header
```sql
CREATE TABLE autoconer_production_header (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_id SERIAL,
  entry_date DATE NOT NULL,
  shift INTEGER NOT NULL CHECK (shift IN (1, 2, 3)),
  supervisor_id UUID REFERENCES supervisors(id),
  total_time INTEGER DEFAULT 510,
  remarks TEXT,
  is_locked BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(entry_date, shift)
);
```

#### Table: autoconer_production_detail
```sql
CREATE TABLE autoconer_production_detail (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  header_id UUID NOT NULL REFERENCES autoconer_production_header(id) ON DELETE CASCADE,
  machine_id UUID NOT NULL REFERENCES autoconer_machines(id),
  emp_name VARCHAR(100),
  count_name VARCHAR(100),
  act_prodn DECIMAL(10,2) DEFAULT 0,
  prodn_effi DECIMAL(5,2) DEFAULT 0,
  red_light DECIMAL(5,2) DEFAULT 0,
  idle_drum INTEGER DEFAULT 0,
  idle_reason TEXT,
  waste_kg DECIMAL(10,4) DEFAULT 0,
  waste_percent DECIMAL(5,2) DEFAULT 0,
  session_no INTEGER DEFAULT 1,
  is_verified BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### Table: autoconer_stoppage_entry
```sql
CREATE TABLE autoconer_stoppage_entry (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  production_detail_id UUID NOT NULL REFERENCES autoconer_production_detail(id) ON DELETE CASCADE,
  run_time INTEGER DEFAULT 510,
  stoppage1_id UUID REFERENCES stoppage_details(id),
  stoppage1_time INTEGER DEFAULT 0,
  stoppage2_id UUID REFERENCES stoppage_details(id),
  stoppage2_time INTEGER DEFAULT 0,
  stoppage3_id UUID REFERENCES stoppage_details(id),
  stoppage3_time INTEGER DEFAULT 0,
  stoppage4_id UUID REFERENCES stoppage_details(id),
  stoppage4_time INTEGER DEFAULT 0,
  total_stoppage_time INTEGER DEFAULT 0,
  is_full_stoppage BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### Table: autoconer_machine_setup
```sql
CREATE TABLE autoconer_machine_setup (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  machine_id UUID NOT NULL REFERENCES autoconer_machines(id) UNIQUE,
  count_name VARCHAR(100),
  act_count DECIMAL(10,2) DEFAULT 69.5,
  session_no INTEGER DEFAULT 1,
  run_time INTEGER DEFAULT 510,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

### Implementation Files (To Be Created)

#### Backend (API Routes)
- `src/app/api/post-preparatory/autoconer/route.js` - CRUD for autoconer production
- `src/lib/supabase/autoconerEntryQueries.js` - Database queries

#### Frontend Pages
- `src/app/post-preparatory/autoconer/page.jsx` - Main entry page with 3 tabs

#### Components
- `src/components/modules/post-preparatory/AutoconerProductionTab.jsx`
- `src/components/modules/post-preparatory/AutoconerStoppageTab.jsx`
- `src/components/modules/post-preparatory/AutoconerMachineSetupTab.jsx`

---

## Phase 10: Database Schema (Supabase/PostgreSQL)

### Technology Stack
- **Database:** Supabase (PostgreSQL)
- **Authentication:** Supabase Auth
- **Storage:** Supabase Storage (for future file uploads)
- **Real-time:** Supabase Realtime (optional for live updates)

### 10.1 Database Schema - All Tables

#### Table 1: departments
```sql
CREATE TABLE departments (
    code SERIAL PRIMARY KEY,
    department VARCHAR(100) NOT NULL,
    sl_no INTEGER NOT NULL UNIQUE,
    hok DECIMAL(3,1) DEFAULT 0.0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by VARCHAR(50),
    is_active BOOLEAN DEFAULT TRUE
);

-- Enable Row Level Security
ALTER TABLE departments ENABLE ROW LEVEL SECURITY;

-- Create policy for authenticated users
CREATE POLICY "Enable read access for all authenticated users" ON departments
    FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Enable insert for authenticated users" ON departments
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Enable update for authenticated users" ON departments
    FOR UPDATE USING (auth.role() = 'authenticated');
```

#### Table 2: spinning_machines
```sql
CREATE TABLE spinning_machines (
    frame_no SERIAL PRIMARY KEY,
    mc_id VARCHAR(20) NOT NULL UNIQUE,
    description VARCHAR(50) NOT NULL,
    make_name VARCHAR(50) NOT NULL,
    model VARCHAR(50),
    no_of_spindles INTEGER NOT NULL,
    group_no INTEGER NOT NULL DEFAULT 0,
    installed_date DATE NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    production_kgs_manual_entry BOOLEAN DEFAULT FALSE,
    direct_hank_entry BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE spinning_machines ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable all operations for authenticated users" ON spinning_machines
    FOR ALL USING (auth.role() = 'authenticated');
```

#### Table 3: stoppage_heads
```sql
CREATE TABLE stoppage_heads (
    code SERIAL PRIMARY KEY,
    stoppage_head_name VARCHAR(100) NOT NULL UNIQUE,
    description VARCHAR(255),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE stoppage_heads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable all operations for authenticated users" ON stoppage_heads
    FOR ALL USING (auth.role() = 'authenticated');
```

#### Table 4: stoppage_details
```sql
CREATE TABLE stoppage_details (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    stoppage_head_id UUID NOT NULL REFERENCES stoppage_heads(id) ON DELETE CASCADE,
    department_id UUID REFERENCES departments(id) ON DELETE SET NULL,
    code INTEGER NOT NULL,
    stoppage_name TEXT NOT NULL,
    description TEXT,
    short_code VARCHAR(10),
    full_stoppage_name TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(stoppage_head_id, code)
);

-- Create sequence for auto-incrementing code starting from 1447
CREATE SEQUENCE IF NOT EXISTS stoppage_details_code_seq START WITH 1447;

-- Indexes for performance
CREATE INDEX idx_stoppage_details_code ON stoppage_details(code);
CREATE INDEX idx_stoppage_details_stoppage_head_id ON stoppage_details(stoppage_head_id);
CREATE INDEX idx_stoppage_details_department_id ON stoppage_details(department_id);
CREATE INDEX idx_stoppage_details_stoppage_name ON stoppage_details(stoppage_name);

ALTER TABLE stoppage_details ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable all operations for authenticated users" ON stoppage_details
    FOR ALL USING (auth.role() = 'authenticated');

-- Sample Data (33 records from VB6 application)
-- Insert statements using DO block to resolve foreign keys
DO $$
DECLARE
  dept_carding UUID;
  dept_spinning UUID;
  dept_autoconer UUID;
  dept_finisher_drawing UUID;
  dept_simplex UUID;
  dept_breaker_drawing UUID;
  dept_comber UUID;
  dept_lap_former UUID;
  head_elect_breakdown UUID;
  head_mainten_breakdown UUID;
  head_mainten_routine UUID;
  head_others UUID;
BEGIN
  -- Get department IDs
  SELECT id INTO dept_carding FROM departments WHERE dept_name = 'CARDING' LIMIT 1;
  SELECT id INTO dept_spinning FROM departments WHERE dept_name = 'SPINNING' LIMIT 1;
  SELECT id INTO dept_autoconer FROM departments WHERE dept_name = 'AUTOCONER' LIMIT 1;
  SELECT id INTO dept_finisher_drawing FROM departments WHERE dept_name = 'Finisher Drawing' LIMIT 1;
  SELECT id INTO dept_simplex FROM departments WHERE dept_name = 'SIMPLEX' LIMIT 1;
  SELECT id INTO dept_breaker_drawing FROM departments WHERE dept_name = 'BREAKER DRAWING' LIMIT 1;
  SELECT id INTO dept_comber FROM departments WHERE dept_name = 'COMBER' LIMIT 1;
  SELECT id INTO dept_lap_former FROM departments WHERE dept_name = 'LAP FORMER' LIMIT 1;

  -- Get stoppage head IDs
  SELECT id INTO head_elect_breakdown FROM stoppage_heads WHERE stoppage_head_name = 'ELECT. BREAKDOWN' LIMIT 1;
  SELECT id INTO head_mainten_breakdown FROM stoppage_heads WHERE stoppage_head_name = 'MAINTEN. BREAKDOWN' LIMIT 1;
  SELECT id INTO head_mainten_routine FROM stoppage_heads WHERE stoppage_head_name = 'MAINTEN. ROUTINE' LIMIT 1;
  SELECT id INTO head_others FROM stoppage_heads WHERE stoppage_head_name = 'OTHERS' LIMIT 1;

  -- Insert 33 stoppage details
  INSERT INTO stoppage_details (code, stoppage_name, stoppage_head_id, department_id, short_code, description, is_active) VALUES
  (1447, 'LAZY WORK', head_elect_breakdown, dept_carding, 'LW', 'Employee lazy work', true),
  (1448, 'SUSSON GEAR BOX PROBLEM', head_mainten_breakdown, dept_spinning, 'SGP', 'Susson gear box malfunction', true),
  (1449, 'ABC RING CHANGE', head_mainten_routine, dept_spinning, 'ARC', 'Ring replacement', true),
  (1450, 'FRONT ROLL PROBLEM', head_mainten_breakdown, dept_spinning, 'FRP', 'Front roll issue', true),
  (1451, 'DOFFING LIMIT PROBLEM', head_mainten_breakdown, dept_spinning, 'DLP', 'Doffing limit sensor issue', true),
  (1452, 'BOTTOM ROLL PROBLEM', head_mainten_breakdown, dept_spinning, 'BRP', 'Bottom roll malfunction', true),
  (1453, 'TPU TRIP', head_elect_breakdown, dept_spinning, 'TT', 'TPU tripped', true),
  (1454, 'ACB TRIP', head_elect_breakdown, dept_autoconer, 'AT', 'ACB circuit breaker trip', true),
  (1455, 'ROLL STAND PROBLEM', head_mainten_breakdown, dept_spinning, 'RSP', 'Roll stand issue', true),
  (1456, 'DRAFTING ROLLER SERVICE', head_mainten_routine, dept_finisher_drawing, 'DRS', 'Drafting roller maintenance', true),
  (1457, 'CONVERTOR PROBLEM', head_elect_breakdown, dept_autoconer, 'CP', 'Convertor failure', true),
  (1458, 'FLYER SERVICE', head_mainten_breakdown, dept_simplex, 'FS', 'Flyer maintenance', true),
  (1459, 'RING RAIL HANDLE PROBLEM', head_mainten_breakdown, dept_spinning, 'RHP', 'Ring rail handle issue', true),
  (1460, 'TOP ARM PRESSURE LOCK PROBLEM', head_mainten_breakdown, dept_finisher_drawing, 'TAP', 'Top arm pressure lock', true),
  (1461, 'DRAFTING ARM NOSE PROBLEM', head_mainten_breakdown, dept_spinning, 'DNP', 'Drafting arm nose issue', true),
  (1462, 'SSB CABLE PROBLEM', head_elect_breakdown, dept_spinning, 'SCP', 'SSB cable fault', true),
  (1463, 'SUCTION PROBLEM', head_elect_breakdown, dept_breaker_drawing, 'SP', 'Suction system failure', true),
  (1464, 'INVERTOR PROGRAME WORK', head_elect_breakdown, dept_spinning, 'IPW', 'Invertor programming', true),
  (1465, 'FIVE LEVEL SETTING', head_mainten_breakdown, dept_carding, 'FLS', 'Five level adjustment', true),
  (1466, 'INDY PROBLEM', head_mainten_routine, dept_simplex, 'IP', 'Individual spindle issue', true),
  (1467, 'BEARING CHANGE', head_mainten_breakdown, dept_comber, 'BC', 'Bearing replacement', true),
  (1468, 'DISMANDLING', head_others, dept_spinning, 'DM', 'Machine dismantling', true),
  (1469, 'PISTON SOFT WORK', head_mainten_breakdown, dept_lap_former, 'PSW', 'Piston soft work', true),
  (1470, 'DRAFTING SERVICES', head_mainten_routine, dept_simplex, 'DS', 'Drafting service', true),
  (1471, 'GEAR BOX PROBLEM', head_mainten_breakdown, dept_spinning, 'GBP', 'Gear box malfunction', true),
  (1472, 'SUCTION PRESSURE PROBLEM', head_mainten_breakdown, dept_carding, 'SPP', 'Suction pressure issue', true),
  (1473, 'CIVIL WORK', head_others, dept_spinning, 'CW', 'Civil construction work', true),
  (1474, 'DRAFTING SETTING WORK', head_mainten_breakdown, dept_lap_former, 'DSW', 'Drafting setting', true),
  (1475, 'CRADLE CLEANING WORK', head_mainten_routine, dept_spinning, 'CCW', 'Cradle cleaning', true),
  (1476, 'DEAD BOX WORK', head_mainten_breakdown, dept_carding, 'DBW', 'Dead box maintenance', true),
  (1477, 'EMPTIES MOVEMENT/CYLINDERS SENSOR PROBLEM', head_elect_breakdown, dept_spinning, 'EMP', 'Empty movement sensor', true),
  (1478, 'EMPTIES MOVEMENT PROBLEM', head_mainten_breakdown, dept_autoconer, 'EMP2', 'Empties movement issue', true),
  (1479, 'LINE LOOKING PROBLEM', head_mainten_breakdown, dept_spinning, 'LLP', 'Line locking problem', true)
  ON CONFLICT (stoppage_head_id, code) DO NOTHING;
END $$;

-- Set sequence to continue from 1480
SELECT setval('stoppage_details_code_seq', 1480, false);
```

#### Table 5: spinning_counts
```sql
CREATE TABLE spinning_counts (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    count_name VARCHAR(100) NOT NULL UNIQUE,
    short_desc VARCHAR(50),
    act_count DECIMAL(6,2) NOT NULL,
    mixing_name VARCHAR(100),
    fibre VARCHAR(50),
    comv_40s_value DECIMAL(10,2),
    ukg DECIMAL(10,2),
    effr_exp_hank DECIMAL(5,2),
    effr_exp_prodn DECIMAL(5,2),
    is_running_now BOOLEAN DEFAULT FALSE,
    autoconer_active BOOLEAN DEFAULT FALSE,
    skra_comv_value DECIMAL(10,2),
    cone_weight DECIMAL(10,3),
    effr_actual_prodn DECIMAL(5,2),
    tpi VARCHAR(50),
    speed VARCHAR(50),
    speed_autoconer DECIMAL(10,2),
    tw_con VARCHAR(50),
    waste_percent DECIMAL(5,2),
    doff_loss DECIMAL(5,2),
    auto_effi DECIMAL(5,2),
    hok_cons DECIMAL(10,2),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    is_active BOOLEAN DEFAULT TRUE
);

-- Create indexes for performance
CREATE INDEX idx_spinning_counts_count_name ON spinning_counts(count_name);
CREATE INDEX idx_spinning_counts_is_active ON spinning_counts(is_active);

ALTER TABLE spinning_counts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable all operations for authenticated users" ON spinning_counts
    FOR ALL USING (auth.role() = 'authenticated');

-- Sample data (21 records from VB6 application)
INSERT INTO spinning_counts (count_name, act_count, is_active) VALUES
('60 COMBED GOLD', 60.5, true),
('61 COMBED SPECIAL', 66, true),
('62 COMBED COMPACT', 62, true),
('63 COM GOLD', 64.5, true),
('66 COMBED GOLD', 68.5, true),
('66 COMBED STAR', 68.5, true),
('64 COMBED', 66, true),
('60COME STAR', 60.5, true),
('60COM COMPACT', 60.5, true),
('65 COMBED STAR', 68.5, true),
('60CCT', 60.5, true),
('65COMBED GOLD', 68.5, true),
('60cs STAR', 60.5, true),
('6 COMPACT STAR', 66, true),
('6 COMBED COMPACT', 61.8, true),
('68 COMBED STAR', 69.5, true),
('6 COMBED DIAMOND', 61.8, true),
('92 COMBED WARP', 93, true),
('80 COMBED COMPACT WARP', 80.5, true),
('91 COMBED WARP', 91, true),
('80 COMBED WARP', 80.5, true)
ON CONFLICT (count_name) DO NOTHING;
```

#### Table 6: hok_strength_head
```sql
CREATE TABLE hok_strength_head (
    hok_id SERIAL PRIMARY KEY,
    date DATE NOT NULL,
    total_shift1 DECIMAL(10,2),
    total_shift2 DECIMAL(10,2),
    total_shift3 DECIMAL(10,2),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE hok_strength_head ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable all operations for authenticated users" ON hok_strength_head
    FOR ALL USING (auth.role() = 'authenticated');
```

#### Table 7: hok_strength_detail
```sql
CREATE TABLE hok_strength_detail (
    id SERIAL PRIMARY KEY,
    hok_id INTEGER NOT NULL,
    department_code INTEGER NOT NULL,
    shift1 DECIMAL(10,1),
    shift2 DECIMAL(10,1),
    shift3 DECIMAL(10,1),
    FOREIGN KEY (hok_id) REFERENCES hok_strength_head(hok_id) ON DELETE CASCADE,
    FOREIGN KEY (department_code) REFERENCES departments(code)
);

ALTER TABLE hok_strength_detail ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable all operations for authenticated users" ON hok_strength_detail
    FOR ALL USING (auth.role() = 'authenticated');
```

#### Table 8: supervisors
```sql
CREATE TABLE supervisors (
    code SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    department_code INTEGER NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    FOREIGN KEY (department_code) REFERENCES departments(code)
);

ALTER TABLE supervisors ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable all operations for authenticated users" ON supervisors
    FOR ALL USING (auth.role() = 'authenticated');
```

#### Table 9: autocorner_machines
```sql
CREATE TABLE autocorner_machines (
    id SERIAL PRIMARY KEY,
    mc_id INTEGER NOT NULL,
    group_id INTEGER NOT NULL,
    mc_no VARCHAR(20) NOT NULL UNIQUE,
    description VARCHAR(50) NOT NULL,
    make_name VARCHAR(50) NOT NULL,
    model VARCHAR(50),
    from_drum INTEGER,
    to_drum INTEGER,
    no_of_drums INTEGER NOT NULL,
    speed INTEGER,
    count VARCHAR(50),
    act_effi DECIMAL(5,2),
    installed_date DATE NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    direct_prod_entry BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE autocorner_machines ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable all operations for authenticated users" ON autocorner_machines
    FOR ALL USING (auth.role() = 'authenticated');
```

#### Table 10: tpi_entries
```sql
CREATE TABLE tpi_entries (
    id SERIAL PRIMARY KEY,
    entry_date DATE NOT NULL,
    count_id INTEGER NOT NULL,
    count_name VARCHAR(100) NOT NULL,
    tpi DECIMAL(6,2) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by VARCHAR(50),
    FOREIGN KEY (count_id) REFERENCES spinning_counts(id)
);

-- Indexes for performance
CREATE INDEX idx_tpi_date ON tpi_entries(entry_date);
CREATE INDEX idx_tpi_count ON tpi_entries(count_id);

ALTER TABLE tpi_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable all operations for authenticated users" ON tpi_entries
    FOR ALL USING (auth.role() = 'authenticated');
```

#### Table 11: twc_entries
```sql
CREATE TABLE twc_entries (
    id SERIAL PRIMARY KEY,
    entry_date DATE NOT NULL,
    count_id INTEGER NOT NULL,
    count_name VARCHAR(100) NOT NULL,
    twc DECIMAL(4,1) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by VARCHAR(50),
    FOREIGN KEY (count_id) REFERENCES spinning_counts(id)
);

-- Indexes for performance
CREATE INDEX idx_twc_date ON twc_entries(entry_date);
CREATE INDEX idx_twc_count ON twc_entries(count_id);

ALTER TABLE twc_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable all operations for authenticated users" ON twc_entries
    FOR ALL USING (auth.role() = 'authenticated');
```

### 10.2 Supabase Setup Steps

1. **Create Supabase Project:**
   - Go to https://supabase.com
   - Create new project
   - Copy Project URL and anon key

2. **Run SQL Migrations:**
   - Go to SQL Editor in Supabase Dashboard
   - Run each table creation script above
   - Verify tables are created

3. **Configure Authentication:**
   - Enable Email/Password authentication
   - Set up user roles and permissions

4. **Set up Row Level Security (RLS):**
   - All tables have RLS enabled
   - Policies allow authenticated users full access
   - Customize policies based on user roles

5. **Environment Variables:**
   - Add Supabase credentials to `.env.local`
   - Never commit `.env.local` to git

### 10.3 Sample Supabase Queries in Next.js

```javascript
// src/lib/supabase/queries.js

import { supabase } from '../supabase'

// Department queries
export const getDepartments = async () => {
  const { data, error } = await supabase
    .from('departments')
    .select('*')
    .order('code', { ascending: true })
  
  if (error) throw error
  return data
}

export const createDepartment = async (department) => {
  const { data, error } = await supabase
    .from('departments')
    .insert([department])
    .select()
  
  if (error) throw error
  return data[0]
}

export const updateDepartment = async (code, updates) => {
  const { data, error } = await supabase
    .from('departments')
    .update(updates)
    .eq('code', code)
    .select()
  
  if (error) throw error
  return data[0]
}

export const deleteDepartment = async (code) => {
  const { error } = await supabase
    .from('departments')
    .delete()
    .eq('code', code)
  
  if (error) throw error
}

// Similar functions for other tables...
```

### 10.4 Database Seeding (Optional)

Create a seed script to populate initial data:

```javascript
// scripts/seed.js
import { supabase } from '../src/lib/supabase'

const departments = [
  { department: "BLOW ROOM", sl_no: 1, hok: 0.2 },
  { department: "CARDING", sl_no: 2, hok: 0.2 },
  // ... rest of departments
]

async function seed() {
  const { error } = await supabase
    .from('departments')
    .insert(departments)
  
  if (error) console.error('Seed error:', error)
  else console.log('Seeding complete!')
}

seed()
```

---

## Phase 11: Deployment

### Deployment Options

**Recommended: Vercel (for Next.js)**
1. Connect GitHub repository to Vercel
2. Add Supabase environment variables
3. Deploy automatically on push

**Steps:**
```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel

# Add environment variables in Vercel dashboard
# NEXT_PUBLIC_SUPABASE_URL
# NEXT_PUBLIC_SUPABASE_ANON_KEY
```

---

**Estimated Timeline:** 2-3 months for complete system
