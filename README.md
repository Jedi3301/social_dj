# Social — A High-Fidelity Monochrome Social Network

Social is a production-ready, high-fidelity social web application built with a strict monochrome design language, featuring clean typography, card layouts, responsive navigation, and real-time backend synchronization.

## Features

- **Monochrome & Adaptive Design**: A premium, Figma-aligned visual experience utilizing custom HSL color systems, glassmorphism, responsive grid components, and a robust theme initialization setup.
- **Dynamic Feed**: Read and create posts with support for image/video attachments and real-time like/comment interactions.
- **Dynamic Trending Sidebar**: Live extraction and frequency tracking of hashtags in posts using a dedicated database-backed `hashtag_metrics` table.
- **User Specific Profiles**: Case-insensitive dynamic user routing (`/[username]`) rendering custom display names, profiles pictures, user bios, and personal timelines.
- **Unified Navigation**: Standardized left sidebar for desktop and bottom nav bar for mobile devices.
- **Secure Authentication**: Forced light theme on signup, login, profile setup, and password resets to maintain brand chrome.

## Technology Stack

- **Frontend**: Next.js 16 (React 19, TypeScript), Vanilla CSS (CSS Modules), Lucide React Icons.
- **Backend**: Node.js, Express, PostgreSQL (pg driver), JWT-based auth, Multer for file uploads.

## Getting Started

### Database Setup
1. Ensure PostgreSQL is running.
2. Create your database and configure the environment variables.
3. The server will automatically initialize and sync the required tables (`posts`, `comments`, `post_likes`, `comment_likes`, `hashtag_metrics`, `profiles`, etc.) on start.

### Running the Backend
1. Navigate to `/backend`.
2. Configure your `.env` file with your credentials (see `backend/.env.example`).
3. Run the development server:
   ```bash
   npm install
   npm start
   ```

### Running the Frontend
1. Navigate to `/frontend`.
2. Run the development server:
   ```bash
   npm install
   npm run dev
   ```
3. Open `http://localhost:3000` in your browser.
