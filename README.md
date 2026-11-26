# Busflowa

BUS FLOW — Premium Bus Management & Ticketing App (Mobile-first PWA)

Build a premium, mobile-first application called BUS FLOW. This is a bus transportation, conductor ticket booking, payment, and administration platform, matching the design and layout in the attached mockup image.

PROJECT DEVELOPMENT PHASE 1

Start by building only these three sections fully:

1. Animated Splash Screen
2. Login & Create Account
3. Admin Dashboard

Prepare the architecture for the future Conductor section, but do not build the entire Conductor dashboard yet.

---

1. Animated Splash Screen

Create a premium, modern opening screen for BUS FLOW.

Design:
- Clean white and light-blue background.
- Premium dark-navy typography.
- BUS FLOW logo positioned in the center.
- A small realistic bus moving smoothly along a road or curved path.
- Subtle road movement and light motion effects.
- Minimal, elegant, fluid animation.
- No clutter or oversized 3D objects.

Loading animation:
- The moving bus should act as the main loader.
- Add a small animated loading indicator beneath the bus.
- Text: "Connecting to your journey..."
- The bus movement and loading animation must appear on the same splash screen.
- Do not use a separate infinity loader.
- Smooth animation, optimized for mobile devices.

Splash flow:
Splash screen → Automatic loading → Login screen.
Do not require the user to tap to continue.

---

2. Login Screen

Create a premium mobile-friendly login interface.

UI elements:
- BUS FLOW logo
- Welcome back
- "Sign in to continue"
- Email address field
- Password field with show/hide toggle
- Remember me
- Forgot password
- Login button
- "Don't have an account? Create Account"

Design:
- Rounded input fields
- Subtle floating cards
- Blue primary CTA
- Minimal icons
- Soft shadows
- Proper mobile spacing
- Keyboard-friendly layout

Authentication rules:
Use secure authentication with role-based access.

Supported roles:
- Admin
- Conductor

The app must identify the user's role after login and automatically redirect them to their authorized dashboard.
Never allow a conductor to access the admin dashboard.

---

3. Create Account — Admin Registration

The public Create Account section must create an Admin account only.

Registration fields:
- Full name
- Email
- Phone number
- Password
- Confirm password

Buttons:
- Create Admin Account
- Already have an account? Login

After successful registration:
Create Account → Admin account created → Automatically log in → Admin Dashboard

Do not show a public Conductor registration option.
Do not allow public users to select their role and register themselves as a conductor.

---

4. Admin Dashboard

Create a premium, responsive Admin Dashboard designed specifically for mobile screens.

Header:
- BUS FLOW branding
- Greeting: "Hello, Admin"
- Admin name
- Profile icon
- Notification bell

Dashboard summary cards:
- Total Buses
- Active Routes
- Total Conductors
- Today's Bookings
Cards should be compact, attractive, and responsive.

Admin Quick Access:
Create clean floating-style or rounded shortcut cards for:
- Users & Staff
- Bus Owners
- Manage Buses
- Manage Routes
- Conductors
- Bookings
- Passengers
- Reports & Analytics
- Notifications
- Settings

Users & Staff section:
This will be the main administrative function.
Admin can:
- Add new staff members
- Create conductor accounts
- Enter conductor full name
- Assign email address
- Set initial password
- Assign bus
- Assign route
- Activate or deactivate staff accounts
- Edit staff details
- Reset passwords
- View staff account status

When Admin creates a Conductor account, the account must be stored with the role "conductor".
The created conductor must log in using the email and password assigned by Admin.

Example:
Admin creates:
Name: Rahul
Email: conductor01@busflow.app
Password: Admin-assigned password
Role: Conductor

When Rahul logs in using those credentials, the app must automatically open the Conductor Dashboard, not the Admin Dashboard.
The account must remain registered until it is deactivated or deleted by authorized Admin.

---

5. Role-Based Navigation

Implement authentication-based navigation:
- If Admin logs in → Admin Dashboard.
- If Conductor logs in → Conductor Dashboard.
- If unauthorized → Access denied.
- If logged in → Maintain session securely.
- If logged out → Return to Login Screen.

Create protected routes and role-based permissions.

---

6. UI Design System

Theme: Premium modern transport technology app matching the attached design mockup.
- Primary color: Electric blue
- Secondary color: Light blue
- Background: White / very light grey
- Text: Dark navy
- Cards: Rounded corners, subtle shadows
- Icons: Modern minimal line icons
- Buttons: Rounded, blue, clear labels
- Floating elements: Soft elevation, subtle animation
- Typography: Modern, clean, readable

Make the design mobile-first and responsive for different Android/iOS screen sizes.

---

7. Future App Architecture — Do Not Build Yet

Prepare the architecture for the next development phase: Conductor Dashboard, booking, QR payment, and ticket generation modules.

---

8. Technical Requirements

- Mobile-first installable PWA stack
- Clean and modular code structure
- Reusable components
- Responsive layouts
- Secure authentication & persistent storage
- Role-based access control
- Proper form validation
- Loading states and smooth transitions

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://busflowa.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/becaee98-6883-49f3-973b-73f96f57d8df).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
