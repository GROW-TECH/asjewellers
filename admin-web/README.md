# AS Jewellers - Admin Panel

Separate web-based admin panel for managing the MLM gold savings application.

## Features

- **Dashboard**: Overview with key statistics and metrics
- **User Management**: View, search, suspend/activate users, grant/revoke admin access
- **Subscription Management**: View and filter all user subscriptions
- **Payment Management**: Track all payment transactions and revenue
- **Commission Management**: View and approve referral commissions

## Installation

1. Install dependencies:
```bash
npm install
```

2. Configure environment variables:
- Copy `.env.example` to `.env`
- Update with your Supabase credentials (already configured)

## Development

Run the development server:
```bash
npm run dev
```

The admin panel will be available at: **http://localhost:3000**

## Production Build

Build for production:
```bash
npm run build
```

Preview production build:
```bash
npm run preview
```

## Login

Use your admin credentials to login:
- **Phone Number**: Your registered phone number (e.g., 9876543210)
- **Password**: Your password

Only users with `is_admin = true` can access the admin panel.

## Tech Stack

- **React 18** - UI framework
- **TypeScript** - Type safety
- **Vite** - Build tool
- **React Router** - Routing
- **Supabase** - Backend and database
- **CSS** - Styling

## Features Overview

### Dashboard
- Total users count
- Active subscriptions
- Total revenue
- Commissions paid
- Pending commissions

### User Management
- Search users by name, phone, or referral code
- View user details and status
- Suspend/Activate users
- Grant/Revoke admin privileges
- View join dates and referral codes

### Subscriptions
- Filter by status (All, Active, Completed, Cancelled)
- View subscription details
- Track payment progress
- See bonus amounts and final amounts

### Payments
- Filter by status (All, Completed, Pending, Failed)
- View total revenue
- Track payment types
- Monitor payment dates

### Commissions
- View total, paid, and pending commissions
- Filter by status
- Mark commissions as paid
- Track commission levels and percentages

## Deployment

This admin panel can be deployed to:
- **Vercel**: Connect your git repository
- **Netlify**: Drag and drop the `dist` folder
- **Any static hosting**: Upload the built files

Build command: `npm run build`
Output directory: `dist`

## Security

- Admin access is protected by authentication
- Only users with `is_admin = true` can access
- Uses Supabase Row Level Security (RLS)
- All data fetching respects database permissions
