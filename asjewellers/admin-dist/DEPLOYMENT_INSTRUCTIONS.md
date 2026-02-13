# AS Jewellers Admin Panel - Deployment Instructions

## 📦 What's Included

This ZIP file contains the complete, production-ready admin panel for AS Jewellers MLM Gold Savings platform.

```
admin-dist/
├── index.html              # Main HTML file
├── assets/                 # CSS and JavaScript files
│   ├── index-D1DlHcqY.css
│   └── index-CDcR8LhL.js
└── DEPLOYMENT_INSTRUCTIONS.md (this file)
```

## 🚀 Deployment Options

### Option 1: Vercel (Recommended - Free & Easy)

1. Go to [vercel.com](https://vercel.com) and sign up/login
2. Click "Add New Project"
3. Click "Deploy" at the bottom
4. Drag and drop this entire `admin-dist` folder
5. Click "Deploy"
6. Done! You'll get a URL like: `https://as-jewellers-admin.vercel.app`

### Option 2: Netlify (Also Free & Easy)

1. Go to [netlify.com](https://netlify.com) and sign up/login
2. Click "Add new site" → "Deploy manually"
3. Drag and drop this entire `admin-dist` folder
4. Done! You'll get a URL like: `https://as-jewellers-admin.netlify.app`

### Option 3: Any Static Web Host

You can upload these files to any web hosting service that supports static websites:
- GitHub Pages
- Firebase Hosting
- Cloudflare Pages
- AWS S3 + CloudFront
- Any shared hosting with file upload

Just upload all files maintaining the folder structure.

## ⚙️ Important Configuration

Before deploying, you need to ensure the Supabase credentials are set correctly.

The admin panel expects these environment variables:
- `VITE_SUPABASE_URL` - Your Supabase project URL
- `VITE_SUPABASE_ANON_KEY` - Your Supabase anonymous key

**These are already embedded in the build** from your `.env` file.

If you need to change them later:
1. Go back to the source code in `admin-web/` folder
2. Update the `.env` file
3. Run `npm run build`
4. Re-deploy the new `admin-dist` folder

## 🔐 Admin Access

Only users with `is_admin = true` in the database can login.

**Your Admin Credentials:**
- Phone: `8870669587`
- Password: (your existing password)

## 🎨 Features

- 📊 Dashboard with real-time statistics
- 👥 User management (search, suspend, grant admin)
- 💰 Transaction monitoring
- 🏦 Withdrawal request approval
- 📦 Subscription management
- 🏆 Commission tracking

## 🛠️ Technical Details

- Built with React 18 + TypeScript
- Vite build system
- Production optimized and minified
- Total size: ~375 KB (gzipped: ~106 KB)
- Works on all modern browsers

## 📱 Mobile Support

The admin panel is fully responsive and works on:
- Desktop computers
- Tablets
- Mobile phones

## 🆘 Troubleshooting

**Issue: Blank page after deployment**
- Check browser console for errors
- Ensure base path is set correctly in hosting settings
- For subdirectory hosting, you may need to adjust asset paths

**Issue: Can't login**
- Verify Supabase credentials are correct
- Check that your admin user has `is_admin = true` in database
- Ensure Supabase URL is accessible

**Issue: Data not loading**
- Check browser console for API errors
- Verify Supabase RLS policies allow admin access
- Ensure database tables exist

## 📞 Support

If you encounter any issues:
1. Check the browser console for error messages
2. Verify your Supabase project is active
3. Ensure admin privileges are set correctly in database

## 🔄 Updates

To update the admin panel:
1. Rebuild from source: `cd admin-web && npm run build`
2. Re-deploy the new `admin-dist` folder
3. Clear browser cache if needed

---

**Built with ❤️ for AS Jewellers**

Admin Panel Version: 1.0.0
Build Date: 2025-11-12
