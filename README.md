# Stream My List

**Find your TMDB watchlist movies across streaming services instantly.**

A client-side web application that helps you discover which movies from your TMDB watchlist are available on your streaming services, across multiple countries.

🔗 **[Live Demo](https://stream-my-list.netlify.app/)** (coming soon)

**Made for people who have too many watchlists and too little time.**

---

## What It Does

Stream My List connects to your [TMDB](https://www.themoviedb.org/) account, fetches your movie watchlist, and shows you which films are available on your streaming services. It's perfect for:

- 🌍 **Multi-country households** - Check streaming availability across different regions
- 🎬 **Movie enthusiasts** - Manage large watchlists and find what's actually streamable
- ⚡ **Quick decisions** - Filter by genre, year, rating, and streaming service

---

## Getting Started

### Prerequisites

1. **TMDB Account** - [Sign up for free](https://www.themoviedb.org/signup)
2. **TMDB Watchlist** - Add some movies to your watchlist
3. **Modern Browser** - Chrome, Firefox, Safari, or Edge (latest versions)


### Importing from IMDb

Don't have a TMDB watchlist yet? No problem!

1. **Export from IMDb**:
   - Go to your [IMDb watchlist](https://www.imdb.com/list/watchlist)
   - Click "Edit" → "Export"
   - Download as CSV

2. **Import to TMDB**:
   - Go to [TMDB Import Settings](https://www.themoviedb.org/settings/import-list)
   - Upload your IMDb CSV file
   - Wait for import to complete

3. **Start using the app!**


---

## Credits & Attribution

### APIs & Data

- **[TMDB](https://www.themoviedb.org/)** - Movie data, ratings, posters, and authentication
- **[JustWatch](https://www.justwatch.com/)** - Streaming availability data (via TMDB)

### Development

Made with ❤️ and 🌀 (hyperfocus) by [Mariana Moreira](https://github.com/mtrocadomoreira)

This app was developed **with the assistance of an LLM coding assistant** (Claude by Anthropic).

---

## Notes about the development

This project was made for learning (and hyperfocus) purposes. This section is for anyone who is interested in the implementation.

### Architecture

This is a **pure client-side application** with no backend server. All the magic happens in your browser using:

- **Vanilla JavaScript** - No frameworks, just clean ES6+
- **TMDB API v3** - Movie data and streaming availability
- **JustWatch Integration** - Streaming provider information (via TMDB)
- **localStorage** - Session persistence and caching

### Data Flow

```
1. User logs in via TMDB OAuth
   ↓
2. Selects countries & streaming services
   ↓
3. App fetches watchlist from TMDB API
   ↓
4. For each movie (in batches of 15):
   - Fetches streaming availability
   - Checks cache first (24h TTL)
   - Filters by selected countries/services
   ↓
5. Results displayed progressively
   ↓
6. User can filter, sort, and click through to TMDB/streaming links
```

### API Usage

The app makes efficient use of the TMDB API:

- **Rate Limiting**: Max 40 requests/second (configurable)
- **Caching Strategy**:
  - Watchlist: 1 hour TTL
  - Streaming data: 24 hours TTL
  - Genres: 7 days TTL
- **Batch Processing**: Processes movies in groups to balance speed and API limits

### Security & Privacy

- **API Key Visibility**: The TMDB API key is visible in the source code. This is intentional for a client-side app and identifies the application (not individual users).
- **User Authentication**: Handled securely via TMDB's OAuth session flow.
- **No Data Collection**: Your watchlist data stays in your browser. Nothing is sent to any third-party servers.
- **Session Storage**: Optional "Remember Me" stores session locally. You can disable this anytime.

### Code Highlights

#### Caching System
```javascript
// 3-tier caching with TTLs
cache: {
  watchlist: null,           // 1 hour
  streamingData: {},         // 24 hours
  genres: null               // 7 days
}
```

#### Progressive Loading
```javascript
// Batch processing with live UI updates
const BATCH_SIZE = 15;
for (let i = 0; i < movies.length; i += BATCH_SIZE) {
  const batch = movies.slice(i, i + BATCH_SIZE);
  // Process batch...
  this.renderMovies(); // Update UI immediately
}
```

#### Configuration Change Detection
```javascript
// Auto-refresh when user changes settings
hasConfigurationChanged() {
  const countriesChanged = /* compare arrays */;
  const servicesChanged = /* compare arrays */;
  return countriesChanged || servicesChanged;
}
```

---

## License

MIT License - feel free to use, modify, and distribute.

See [LICENSE](LICENSE) for details.


---

## FAQ

**Q: Why does the search take so long?**
A: The app needs to fetch streaming data for every movie in your watchlist. Longer watchlists take longer ☹️

**Q: Can I use this without a TMDB account?**
A: No, you need a TMDB account to access your watchlist. It's free to sign up!

**Q: Does this work with Netflix/Hulu/etc.?**
A: Yes! The app shows availability across all streaming services that TMDB/JustWatch tracks.



