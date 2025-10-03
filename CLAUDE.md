# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a client-side web application called "What to Stream?" that helps users find their TMDB watchlist movies across streaming services. It's a pure frontend app with no build step - just HTML, CSS, and vanilla JavaScript.

## Setup & Configuration

### TMDB API Key Setup

**IMPORTANT:** Before using the app, configure your TMDB API key:

1. Get your TMDB API Read Access Token (Bearer token) from: https://www.themoviedb.org/settings/api
2. Open `app.js` and replace `'YOUR_TMDB_API_KEY_HERE'` on line 14 with your actual token
3. Save the file

**Security Note:** The API key is hardcoded and visible in the source code. This is intentional for a client-side-only app with no backend. The key identifies your application to TMDB (not individual users). User authentication is handled securely via TMDB's OAuth session flow. TMDB rate-limits by API key, and you can rotate it if abused.

## Running the Application

Simply open `index.html` in a web browser. No build process, npm install, or local server required (though a local server is recommended for development to avoid CORS issues if that becomes relevant).

## Architecture

### File Structure
- `index.html` - Single-page application with two main views (home and results)
- `app.js` - All application logic in a single `MovieStreamingApp` class
- `style.css` - Complete styling with CSS custom properties for theming

### Key Design Patterns

**State Management**: The app uses a centralized state object in the `MovieStreamingApp` class:
- `apiKey` - Hardcoded TMDB API key (identifies the app)
- `sessionId`, `accountId`, `username` - TMDB user authentication
- `isAuthenticated`, `rememberMe` - Auth state
- `selectedCountries`, `selectedServices` - User's configuration
- `movies`, `filteredMovies` - Movie data and filtered results
- `filters` - All filter settings (year range, rating range, genres, services)
- `currentSort` - Current sorting preference
- `currentPage`, `wizardStep` - UI state

**Data Flow**:
1. User clicks "Login with TMDB" → OAuth redirect flow → Session created & stored in localStorage
2. User selects countries/services → Configuration modal
3. "Tell Me What to Stream" button → Fetches all watchlist pages using session_id
4. For each movie → Fetches streaming availability for selected countries/services
5. Filters matched movies → Renders filtered results

**API Integration**: All data comes from TMDB API v3:
- Uses Bearer token authentication (hardcoded API key in headers)
- User-specific requests use `session_id` query parameter
- Fetches: countries, streaming providers, watchlist movies, watch providers by movie, genres
- All calls wrapped in rate limiting (4 requests/second max)
- All calls in `app.js` using native `fetch()`

**Authentication Flow**:
1. User clicks "Login with TMDB"
2. App creates request token via TMDB API
3. Redirects user to TMDB.org for authorization
4. User approves, TMDB redirects back to app
5. App exchanges approved token for session_id
6. Fetches account details (account_id, username)
7. Saves session to localStorage (if "Remember Me" checked)
8. Auto-loads session on future visits

### Important Implementation Details

**Genre Color Mapping**: `getGenreColor()` method maps 19 standard movie genres to specific colors. Each genre has `bg`, `text`, and `border` properties for consistent styling. Unknown genres get a hash-based color.

**Filter System**:
- **Year & Rating**: Double-ended range sliders (min/max) with synchronized state
- **Genres & Services**: Multi-select checkboxes with OR logic (movies matching ANY selected item)
- All filters work together (AND between filter types, OR within each type)

**Streaming Availability Logic**: Movies only appear in results if they're available on at least one selected service in at least one selected country. The `fetchStreamingInfo()` method returns a structured object keyed by country code.

## Color Palette

The app uses a fixed dark theme with these brand colors:
- `#724270` - Purple dark
- `#a94270` - Purple medium
- `#e34270` - Pink bright (error/accent)
- `#4ee3d6` - Cyan bright (primary - links, buttons, highlights)
- `#4e8076` - Teal dark

Background is dark grey (`#18181b`), text is light grey (`#f5f5f5`) for high contrast.

## Typography

- **Base font**: Geist/Inter fallback stack
- **Title font**: "Special Gothic Expanded One" - used for ALL headings and movie titles
  - Loaded from Google Fonts CDN
  - Always uppercase with expanded letter-spacing

## Critical UI Components

**Double-ended Range Sliders**: Year and rating filters use two overlapping `<input type="range">` elements positioned absolutely. Event handlers ensure min never exceeds max and vice versa.

**Movie Cards**: Use flexbox with `aspect-ratio: 2/3` for posters to maintain proper movie poster dimensions. Cards are narrow (minmax 200px) to show full-height posters.

**Modal Wizard**: Two-step flow (countries → services) using `.active` class toggle. Selected items sorted to top of lists.

## State Persistence

**localStorage Usage**:
- Session data (session_id, account_id, username) saved if "Remember Me" checked
- API key stored in session for OAuth callback (cleared after auth completes)
- Selected countries and services persisted with session
- 30-day session expiration
- User can disable persistence via "Remember Me" checkbox

## No External Dependencies

This is a vanilla JavaScript app with zero npm packages, build tools, or frameworks. All functionality uses native browser APIs.
