LAVA Authentication Final Changes

frontend/
  App.jsx       - customer login UI, OTP flow, admin security settings UI
  auth.js       - auth/config/OTP/admin-config API calls

backend/
  server.js
  controllers/authController.js
  controllers/settingsController.js
  models/EmailOtp.js
  models/User.js
  models/Settings.js
  routes/authRoutes.js
  .env.example

Resend:
1) Add RESEND_API_KEY to the backend .env.
2) Keep RESEND_FROM_EMAIL=onboarding@resend.dev for testing, or configure a verified domain in Resend and set the sender from Admin > Login & Security.
3) Customer login mode is controlled from Admin > Login & Security.
4) Admin/staff always use Email + Password.
