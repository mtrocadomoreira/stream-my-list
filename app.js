// Movie Streaming Finder App with TMDB API Integration
class MovieStreamingApp {
    constructor() {
        // SECURITY NOTE: In a pure client-side application, there is no way to truly hide an API key.
        // The TMDB API key below identifies this application (not individual users).
        // User-specific authentication is handled securely via TMDB's session-based OAuth flow.
        // The API key is intentionally visible in the source code as this is a client-side app with no backend.
        // TMDB rate-limits API usage per key, and the key can be rotated if abused.
        //

        this.state = {
            apiKey: 'eyJhbGciOiJIUzI1NiJ9.eyJhdWQiOiIwNGMyMDEwMmYzMWVlMTZiMTc0MDIzMjE0YzBmYjljZCIsIm5iZiI6MTc1MzQwMzkyMC44ODcsInN1YiI6IjY4ODJkMjEwZjlmY2M5NWI5YWQ5YTUxZCIsInNjb3BlcyI6WyJhcGlfcmVhZCJdLCJ2ZXJzaW9uIjoxfQ.LiCkhm2nVGqCCUVUKu7t4dh2ruNvAp-gBAYpJQMYco8', 
            sessionId: '',
            accountId: '',
            username: '',
            requestToken: '',
            isAuthenticated: false,
            rememberMe: true,
            selectedCountries: [],
            selectedServices: [],
            movies: [],
            filteredMovies: [],
            currentSort: 'relevance',
            filters: {
                yearMin: 1900,
                yearMax: 2025,
                ratingMin: 0,
                ratingMax: 10,
                genres: [],
                services: []
            },
            currentPage: 'home',
            wizardStep: 'countries'
        };

        this.data = {
            countries: [],
            streamingServices: [],
            genres: {}
        };

        this.rateLimiting = {
            requests: [],
            maxRequestsPerSecond: 40
        };

        this.cache = {
            watchlist: null,
            watchlistExpiry: null,
            streamingData: {}, // movieId -> {data, expiry}
            genres: null,
            genresExpiry: null
        };

        this.cacheConfig = {
            watchlistTTL: 60 * 60 * 1000, // 1 hour
            streamingTTL: 24 * 60 * 60 * 1000, // 24 hours
            genresTTL: 7 * 24 * 60 * 60 * 1000 // 7 days
        };

        this.searchState = {
            isSearching: false,
            shouldCancel: false,
            totalMovies: 0,
            processedMovies: 0,
            foundMovies: 0
        };

        this.init();
    }

    init() {
        this.loadStoredSession();
        this.loadCacheFromStorage();
        this.handleAuthCallback();
        this.bindEvents();
        this.updateUI();
    }

    // ===== Cache Management =====

    loadCacheFromStorage() {
        try {
            const stored = localStorage.getItem('tmdb_cache');
            if (!stored) return;

            const cacheData = JSON.parse(stored);
            this.cache = {
                watchlist: cacheData.watchlist || null,
                watchlistExpiry: cacheData.watchlistExpiry || null,
                streamingData: cacheData.streamingData || {},
                genres: cacheData.genres || null,
                genresExpiry: cacheData.genresExpiry || null
            };
        } catch (error) {
            console.error('Error loading cache:', error);
            this.clearCache();
        }
    }

    saveCacheToStorage() {
        try {
            localStorage.setItem('tmdb_cache', JSON.stringify(this.cache));
        } catch (error) {
            console.error('Error saving cache:', error);
        }
    }

    clearCache() {
        this.cache = {
            watchlist: null,
            watchlistExpiry: null,
            streamingData: {},
            genres: null,
            genresExpiry: null
        };
        try {
            localStorage.removeItem('tmdb_cache');
        } catch (error) {
            console.error('Error clearing cache:', error);
        }
    }

    getCachedWatchlist() {
        if (this.cache.watchlist && this.cache.watchlistExpiry && Date.now() < this.cache.watchlistExpiry) {
            return this.cache.watchlist;
        }
        return null;
    }

    setCachedWatchlist(data) {
        this.cache.watchlist = data;
        this.cache.watchlistExpiry = Date.now() + this.cacheConfig.watchlistTTL;
        this.saveCacheToStorage();
    }

    getCachedStreamingInfo(movieId) {
        const cached = this.cache.streamingData[movieId];
        if (cached && Date.now() < cached.expiry) {
            return cached.data;
        }
        return null;
    }

    setCachedStreamingInfo(movieId, data) {
        this.cache.streamingData[movieId] = {
            data: data,
            expiry: Date.now() + this.cacheConfig.streamingTTL
        };
        this.saveCacheToStorage();
    }

    getCachedGenres() {
        if (this.cache.genres && this.cache.genresExpiry && Date.now() < this.cache.genresExpiry) {
            return this.cache.genres;
        }
        return null;
    }

    setCachedGenres(genres) {
        this.cache.genres = genres;
        this.cache.genresExpiry = Date.now() + this.cacheConfig.genresTTL;
        this.saveCacheToStorage();
    }

    // ===== localStorage Management =====

    saveToLocalStorage() {
        if (!this.state.rememberMe) return;

        const sessionData = {
            sessionId: this.state.sessionId,
            accountId: this.state.accountId,
            username: this.state.username,
            apiKey: this.state.apiKey,
            selectedCountries: this.state.selectedCountries,
            selectedServices: this.state.selectedServices,
            savedAt: Date.now()
        };

        try {
            localStorage.setItem('tmdb_session', JSON.stringify(sessionData));
        } catch (error) {
            console.error('Error saving to localStorage:', error);
        }
    }

    loadStoredSession() {
        try {
            const stored = localStorage.getItem('tmdb_session');
            if (!stored) return;

            const sessionData = JSON.parse(stored);

            // Check if session is older than 30 days (optional expiration)
            const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;
            if (Date.now() - sessionData.savedAt > thirtyDaysMs) {
                this.clearStoredSession();
                return;
            }

            this.state.sessionId = sessionData.sessionId || '';
            this.state.accountId = sessionData.accountId || '';
            this.state.username = sessionData.username || '';
            this.state.apiKey = sessionData.apiKey || '';
            this.state.selectedCountries = sessionData.selectedCountries || [];
            this.state.selectedServices = sessionData.selectedServices || [];
            this.state.isAuthenticated = !!(this.state.sessionId && this.state.accountId);
            this.state.rememberMe = true;
        } catch (error) {
            console.error('Error loading from localStorage:', error);
            this.clearStoredSession();
        }
    }

    clearStoredSession() {
        try {
            localStorage.removeItem('tmdb_session');
        } catch (error) {
            console.error('Error clearing localStorage:', error);
        }
    }

    // ===== Rate Limiting =====

    async throttleRequest(requestFn) {
        const now = Date.now();
        // Remove requests older than 1 second
        this.rateLimiting.requests = this.rateLimiting.requests.filter(
            timestamp => now - timestamp < 1000
        );

        // Wait if we've hit the rate limit
        if (this.rateLimiting.requests.length >= this.rateLimiting.maxRequestsPerSecond) {
            const oldestRequest = this.rateLimiting.requests[0];
            const waitTime = 1000 - (now - oldestRequest);
            await new Promise(resolve => setTimeout(resolve, waitTime));
            return this.throttleRequest(requestFn);
        }

        this.rateLimiting.requests.push(Date.now());
        return requestFn();
    }

    // ===== Authentication Methods =====

    async initiateLogin() {
        if (!this.state.apiKey || this.state.apiKey === 'YOUR_TMDB_API_KEY_HERE') {
            alert('Error: TMDB API key not configured. Please update the API key in app.js line 14.');
            return;
        }

        try {
            const response = await this.throttleRequest(() =>
                fetch('https://api.themoviedb.org/3/authentication/token/new', {
                    headers: {
                        'accept': 'application/json',
                        'Authorization': `Bearer ${this.state.apiKey}`
                    }
                })
            );

            const data = await response.json();

            if (!data.success || !data.request_token) {
                throw new Error(data.status_message || 'Failed to create request token');
            }

            this.state.requestToken = data.request_token;

            // Save API key temporarily for callback (will be cleared after auth completes)
            try {
                localStorage.setItem('tmdb_temp_auth', JSON.stringify({
                    apiKey: this.state.apiKey,
                    rememberMe: this.state.rememberMe,
                    timestamp: Date.now()
                }));
            } catch (e) {
                console.error('Failed to save temp auth data:', e);
            }

            // Redirect to TMDB for authorization
            const redirectUrl = 'https://stream-my-list.netlify.app/';
            const authUrl = `https://www.themoviedb.org/authenticate/${data.request_token}?redirect_to=${encodeURIComponent(redirectUrl)}`;
            window.location.href = authUrl;
        } catch (error) {
            console.error('Login error:', error);
            alert(`Login failed: ${error.message}`);
        }
    }

    async handleAuthCallback() {
        const urlParams = new URLSearchParams(window.location.search);
        const requestToken = urlParams.get('request_token');
        const approved = urlParams.get('approved');

        if (!requestToken || approved !== 'true') return;

        // Load temp auth data
        let tempAuthData = null;
        try {
            const stored = localStorage.getItem('tmdb_temp_auth');
            if (stored) {
                tempAuthData = JSON.parse(stored);
                // Check if temp auth is not older than 10 minutes
                if (Date.now() - tempAuthData.timestamp > 10 * 60 * 1000) {
                    localStorage.removeItem('tmdb_temp_auth');
                    throw new Error('Authentication session expired. Please try logging in again.');
                }
                this.state.apiKey = tempAuthData.apiKey;
                this.state.rememberMe = tempAuthData.rememberMe;
            }
        } catch (error) {
            console.error('Error loading temp auth:', error);
            alert(error.message || 'Authentication failed. Please try again.');
            return;
        }

        if (!this.state.apiKey) {
            alert('API key not found. Please enter your API key and try logging in again.');
            return;
        }

        // Clear URL parameters
        window.history.replaceState({}, document.title, window.location.pathname);

        try {
            // Create session from approved token
            const sessionResponse = await this.throttleRequest(() =>
                fetch('https://api.themoviedb.org/3/authentication/session/new', {
                    method: 'POST',
                    headers: {
                        'accept': 'application/json',
                        'content-type': 'application/json',
                        'Authorization': `Bearer ${this.state.apiKey}`
                    },
                    body: JSON.stringify({ request_token: requestToken })
                })
            );

            const sessionData = await sessionResponse.json();

            if (!sessionData.success || !sessionData.session_id) {
                throw new Error(sessionData.status_message || 'Failed to create session');
            }

            this.state.sessionId = sessionData.session_id;

            // Fetch account details
            await this.fetchAccountDetails();

            this.state.isAuthenticated = true;

            // Clear temp auth data
            localStorage.removeItem('tmdb_temp_auth');

            // Save to localStorage if remember me is checked
            this.saveToLocalStorage();
            this.updateUI();
        } catch (error) {
            console.error('Authentication callback error:', error);
            localStorage.removeItem('tmdb_temp_auth');
            alert(`Authentication failed: ${error.message}`);
        }
    }

    async fetchAccountDetails() {
        try {
            const response = await this.throttleRequest(() =>
                fetch(`https://api.themoviedb.org/3/account?session_id=${this.state.sessionId}`, {
                    headers: {
                        'accept': 'application/json',
                        'Authorization': `Bearer ${this.state.apiKey}`
                    }
                })
            );

            const data = await response.json();

            if (data.id && data.username) {
                this.state.accountId = data.id.toString();
                this.state.username = data.username;
            } else {
                throw new Error('Invalid account data received');
            }
        } catch (error) {
            console.error('Error fetching account details:', error);
            throw error;
        }
    }

    logout() {
        this.state.sessionId = '';
        this.state.accountId = '';
        this.state.username = '';
        this.state.requestToken = '';
        this.state.isAuthenticated = false;
        this.clearStoredSession();
        this.clearCache(); // Also clear cache on logout
        this.updateUI();
    }

    getGenreColor(genreName) {
        // Consistent color mapping for genres
        const genreColors = {
            'Action': { bg: 'rgba(239, 68, 68, 0.12)', text: '#dc2626', border: 'rgba(239, 68, 68, 0.3)' },
            'Adventure': { bg: 'rgba(249, 115, 22, 0.12)', text: '#ea580c', border: 'rgba(249, 115, 22, 0.3)' },
            'Animation': { bg: 'rgba(236, 72, 153, 0.12)', text: '#db2777', border: 'rgba(236, 72, 153, 0.3)' },
            'Comedy': { bg: 'rgba(245, 158, 11, 0.12)', text: '#d97706', border: 'rgba(245, 158, 11, 0.3)' },
            'Crime': { bg: 'rgba(107, 114, 128, 0.12)', text: '#4b5563', border: 'rgba(107, 114, 128, 0.3)' },
            'Documentary': { bg: 'rgba(139, 92, 246, 0.12)', text: '#7c3aed', border: 'rgba(139, 92, 246, 0.3)' },
            'Drama': { bg: 'rgba(99, 102, 241, 0.12)', text: '#4f46e5', border: 'rgba(99, 102, 241, 0.3)' },
            'Family': { bg: 'rgba(236, 72, 153, 0.12)', text: '#db2777', border: 'rgba(236, 72, 153, 0.3)' },
            'Fantasy': { bg: 'rgba(168, 85, 247, 0.12)', text: '#9333ea', border: 'rgba(168, 85, 247, 0.3)' },
            'History': { bg: 'rgba(120, 113, 108, 0.12)', text: '#78716c', border: 'rgba(120, 113, 108, 0.3)' },
            'Horror': { bg: 'rgba(30, 30, 30, 0.12)', text: '#1f1f1f', border: 'rgba(30, 30, 30, 0.3)' },
            'Music': { bg: 'rgba(244, 63, 94, 0.12)', text: '#e11d48', border: 'rgba(244, 63, 94, 0.3)' },
            'Mystery': { bg: 'rgba(59, 130, 246, 0.12)', text: '#2563eb', border: 'rgba(59, 130, 246, 0.3)' },
            'Romance': { bg: 'rgba(236, 72, 153, 0.12)', text: '#db2777', border: 'rgba(236, 72, 153, 0.3)' },
            'Science Fiction': { bg: 'rgba(6, 182, 212, 0.12)', text: '#0891b2', border: 'rgba(6, 182, 212, 0.3)' },
            'TV Movie': { bg: 'rgba(156, 163, 175, 0.12)', text: '#6b7280', border: 'rgba(156, 163, 175, 0.3)' },
            'Thriller': { bg: 'rgba(185, 28, 28, 0.12)', text: '#b91c1c', border: 'rgba(185, 28, 28, 0.3)' },
            'War': { bg: 'rgba(75, 85, 99, 0.12)', text: '#374151', border: 'rgba(75, 85, 99, 0.3)' },
            'Western': { bg: 'rgba(180, 83, 9, 0.12)', text: '#b45309', border: 'rgba(180, 83, 9, 0.3)' }
        };

        // Return genre-specific color or generate a default color based on hash
        if (genreColors[genreName]) {
            return genreColors[genreName];
        }

        // Fallback: generate color based on string hash
        let hash = 0;
        for (let i = 0; i < genreName.length; i++) {
            hash = genreName.charCodeAt(i) + ((hash << 5) - hash);
        }
        const hue = hash % 360;
        return {
            bg: `hsla(${hue}, 70%, 50%, 0.12)`,
            text: `hsl(${hue}, 70%, 40%)`,
            border: `hsla(${hue}, 70%, 50%, 0.3)`
        };
    }

    bindEvents() {
        // Authentication buttons
        document.getElementById('login-btn').addEventListener('click', () => {
            this.initiateLogin();
        });

        document.getElementById('logout-btn').addEventListener('click', () => {
            this.logout();
        });

        document.getElementById('remember-me').addEventListener('change', (e) => {
            this.state.rememberMe = e.target.checked;
            if (!this.state.rememberMe) {
                this.clearStoredSession();
            }
        });

        // Main buttons
        document.getElementById('config-btn').addEventListener('click', () => {
            this.openConfigModal();
        });

        document.getElementById('search-btn').addEventListener('click', () => {
            this.searchMovies();
        });

        document.getElementById('cancel-search').addEventListener('click', () => {
            this.cancelSearch();
        });

        // Modal events
        document.getElementById('close-modal').addEventListener('click', () => {
            this.closeModal();
        });

        document.getElementById('close-modal-2').addEventListener('click', () => {
            this.closeModal();
        });

        document.querySelector('.modal-backdrop').addEventListener('click', () => {
            this.closeModal();
        });

        document.getElementById('continue-to-services').addEventListener('click', () => {
            this.goToServicesStep();
        });

        document.getElementById('back-to-countries').addEventListener('click', () => {
            this.goToCountriesStep();
        });

        document.getElementById('save-config').addEventListener('click', () => {
            this.saveConfiguration();
        });

        // Search inputs
        document.getElementById('country-search').addEventListener('input', (e) => {
            this.filterCountries(e.target.value);
        });

        document.getElementById('service-search').addEventListener('input', (e) => {
            this.filterServices(e.target.value);
        });

        // Results page events
        document.getElementById('back-home-btn').addEventListener('click', () => {
            this.goToHomePage();
        });

        document.getElementById('sort-select').addEventListener('change', (e) => {
            this.state.currentSort = e.target.value;
            this.applyFiltersAndSort();
        });

        document.getElementById('filters-toggle').addEventListener('click', () => {
            this.toggleFilters();
        });

        // Filter inputs - Year range
        document.getElementById('filter-year-min').addEventListener('input', (e) => {
            const min = parseInt(e.target.value);
            const max = parseInt(document.getElementById('filter-year-max').value);
            if (min > max) {
                document.getElementById('filter-year-max').value = min;
                this.state.filters.yearMax = min;
            }
            this.state.filters.yearMin = min;
            document.getElementById('year-min-value').textContent = min;
            this.applyFiltersAndSort();
        });

        document.getElementById('filter-year-max').addEventListener('input', (e) => {
            const max = parseInt(e.target.value);
            const min = parseInt(document.getElementById('filter-year-min').value);
            if (max < min) {
                document.getElementById('filter-year-min').value = max;
                this.state.filters.yearMin = max;
            }
            this.state.filters.yearMax = max;
            document.getElementById('year-max-value').textContent = max;
            this.applyFiltersAndSort();
        });

        // Filter inputs - Rating range
        document.getElementById('filter-rating-min').addEventListener('input', (e) => {
            const min = parseFloat(e.target.value);
            const max = parseFloat(document.getElementById('filter-rating-max').value);
            if (min > max) {
                document.getElementById('filter-rating-max').value = min;
                this.state.filters.ratingMax = min;
            }
            this.state.filters.ratingMin = min;
            document.getElementById('rating-min-value').textContent = min.toFixed(1);
            this.applyFiltersAndSort();
        });

        document.getElementById('filter-rating-max').addEventListener('input', (e) => {
            const max = parseFloat(e.target.value);
            const min = parseFloat(document.getElementById('filter-rating-min').value);
            if (max < min) {
                document.getElementById('filter-rating-min').value = max;
                this.state.filters.ratingMin = max;
            }
            this.state.filters.ratingMax = max;
            document.getElementById('rating-max-value').textContent = max.toFixed(1);
            this.applyFiltersAndSort();
        });
    }

    updateUI() {
        const isAuthenticated = this.state.isAuthenticated;
        const hasConfig = this.state.selectedCountries.length > 0 && this.state.selectedServices.length > 0;

        // Update authentication UI
        const loginContainer = document.getElementById('login-container');
        const userProfile = document.getElementById('user-profile');
        const usernameDisplay = document.getElementById('username-display');

        if (isAuthenticated) {
            loginContainer.classList.add('hidden');
            userProfile.classList.remove('hidden');
            usernameDisplay.textContent = this.state.username;
        } else {
            loginContainer.classList.remove('hidden');
            userProfile.classList.add('hidden');
        }

        // Update search button
        const searchBtn = document.getElementById('search-btn');
        searchBtn.disabled = !(isAuthenticated && hasConfig);

        // Update config status
        const configStatus = document.getElementById('config-status');
        const configSummary = document.getElementById('config-summary');

        if (hasConfig) {
            configStatus.classList.remove('hidden');
            const countryNames = this.state.selectedCountries.map(c => c.english_name).join(', ');
            const serviceNames = this.state.selectedServices.map(s => s.provider_name).join(', ');
            configSummary.innerHTML = `<p class="mb-2">Selected countries: ${countryNames}</p><p>Selected services: ${serviceNames}</p>`;
        } else {
            configStatus.classList.add('hidden');
        }
    }

    async openConfigModal() {
        const modal = document.getElementById('config-modal');
        modal.classList.remove('hidden');
        this.goToCountriesStep();

        // Store current configuration to detect changes
        this.previousConfig = {
            countries: [...this.state.selectedCountries],
            services: [...this.state.selectedServices]
        };

        await this.fetchCountries();
    }

    closeModal() {
        const modal = document.getElementById('config-modal');
        modal.classList.add('hidden');
    }

    goToCountriesStep() {
        document.getElementById('countries-step').classList.add('active');
        document.getElementById('services-step').classList.remove('active');
        this.state.wizardStep = 'countries';
    }

    async goToServicesStep() {
        document.getElementById('countries-step').classList.remove('active');
        document.getElementById('services-step').classList.add('active');
        this.state.wizardStep = 'services';
        await this.fetchServices();
    }

    async fetchCountries() {
        this.showLoading('countries-list');
        try {
            const response = await this.throttleRequest(() =>
                fetch('https://api.themoviedb.org/3/watch/providers/regions?language=en-US', {
                    headers: {
                        'accept': 'application/json',
                        'Authorization': `Bearer ${this.state.apiKey}`
                    }
                })
            );
            const data = await response.json();

            if (data.results && data.results.length > 0) {
                this.data.countries = data.results;
                this.renderCountries();
            } else {
                console.error('No results in response:', data);
                this.showError('countries-list', 'No countries found. Please check your API key.');
            }
        } catch (error) {
            console.error('Error fetching countries:', error);
            this.showError('countries-list', 'Error loading countries. Please try again.');
        }
    }

    async fetchServices() {
        this.showLoading('services-list');
        try {
            const serviceMap = new Map();
            for (const country of this.state.selectedCountries) {
                const response = await this.throttleRequest(() =>
                    fetch(
                        `https://api.themoviedb.org/3/watch/providers/movie?language=en-US&watch_region=${country.iso_3166_1}`,
                        { headers: { 'Authorization': `Bearer ${this.state.apiKey}` } }
                    )
                );
                const data = await response.json();
                (data.results || []).forEach(service => {
                    if (!serviceMap.has(service.provider_id)) {
                        serviceMap.set(service.provider_id, service);
                    }
                });
            }
            this.data.streamingServices = Array.from(serviceMap.values()).sort((a, b) =>
                a.provider_name.localeCompare(b.provider_name)
            );
            this.renderServices();
        } catch (error) {
            console.error('Error fetching services:', error);
            this.showError('services-list', 'Error loading services. Please try again.');
        }
    }

    async fetchGenres() {
        // Check cache first
        const cachedGenres = this.getCachedGenres();
        if (cachedGenres) {
            this.data.genres = cachedGenres;
            return;
        }

        try {
            const response = await this.throttleRequest(() =>
                fetch('https://api.themoviedb.org/3/genre/movie/list?language=en', {
                    headers: { 'Authorization': `Bearer ${this.state.apiKey}` }
                })
            );
            const data = await response.json();
            this.data.genres = {};
            (data.genres || []).forEach(genre => {
                this.data.genres[genre.id] = genre.name;
            });
            this.setCachedGenres(this.data.genres);
        } catch (error) {
            console.error('Error fetching genres:', error);
        }
    }

    renderCountries() {
        const container = document.getElementById('countries-list');
        container.innerHTML = '';

        // Sort: selected first
        const selected = this.data.countries.filter(country =>
            this.state.selectedCountries.some(c => c.iso_3166_1 === country.iso_3166_1)
        );
        const unselected = this.data.countries.filter(country =>
            !this.state.selectedCountries.some(c => c.iso_3166_1 === country.iso_3166_1)
        );
        const sortedCountries = [...selected, ...unselected];

        sortedCountries.forEach(country => {
            const item = document.createElement('div');
            item.className = 'checkbox-item';
            const isSelected = this.state.selectedCountries.some(c => c.iso_3166_1 === country.iso_3166_1);
            if (isSelected) {
                item.classList.add('selected');
            }

            item.innerHTML = `
                <input type="checkbox" id="country-${country.iso_3166_1}"
                       ${isSelected ? 'checked' : ''}>
                <label for="country-${country.iso_3166_1}">${country.english_name}</label>
            `;

            item.addEventListener('click', (e) => {
                if (e.target.type !== 'checkbox') {
                    const checkbox = item.querySelector('input[type="checkbox"]');
                    checkbox.checked = !checkbox.checked;
                }
                this.toggleCountry(country);
            });

            container.appendChild(item);
        });

        this.updateContinueButton();
    }

    renderServices() {
        const container = document.getElementById('services-list');
        container.innerHTML = '';

        // Sort: selected first
        const selected = this.data.streamingServices.filter(service =>
            this.state.selectedServices.some(s => s.provider_id === service.provider_id)
        );
        const unselected = this.data.streamingServices.filter(service =>
            !this.state.selectedServices.some(s => s.provider_id === service.provider_id)
        );
        const sortedServices = [...selected, ...unselected];

        sortedServices.forEach(service => {
            const item = document.createElement('div');
            item.className = 'checkbox-item';
            const isSelected = this.state.selectedServices.some(s => s.provider_id === service.provider_id);
            if (isSelected) {
                item.classList.add('selected');
            }

            item.innerHTML = `
                <input type="checkbox" id="service-${service.provider_id}"
                       ${isSelected ? 'checked' : ''}>
                <label for="service-${service.provider_id}">
                    <img src="https://image.tmdb.org/t/p/original${service.logo_path}"
                         alt="${service.provider_name}"
                         class="service-logo"
                         style="width: 32px; height: 32px; border-radius: 6px; margin-right: 8px; vertical-align: middle;">
                    ${service.provider_name}
                </label>
            `;

            item.addEventListener('click', (e) => {
                if (e.target.type !== 'checkbox') {
                    const checkbox = item.querySelector('input[type="checkbox"]');
                    checkbox.checked = !checkbox.checked;
                }
                this.toggleService(service);
            });

            container.appendChild(item);
        });

        this.updateSaveButton();
    }

    filterCountries(searchTerm) {
        const container = document.getElementById('countries-list');
        const items = container.querySelectorAll('.checkbox-item');

        items.forEach(item => {
            const label = item.querySelector('label').textContent.toLowerCase();
            if (label.includes(searchTerm.toLowerCase()) || searchTerm === '') {
                item.classList.remove('hidden');
            } else {
                item.classList.add('hidden');
            }
        });
    }

    filterServices(searchTerm) {
        const container = document.getElementById('services-list');
        const items = container.querySelectorAll('.checkbox-item');

        items.forEach(item => {
            const label = item.querySelector('label').textContent.toLowerCase();
            if (label.includes(searchTerm.toLowerCase()) || searchTerm === '') {
                item.classList.remove('hidden');
            } else {
                item.classList.add('hidden');
            }
        });
    }

    toggleCountry(country) {
        const index = this.state.selectedCountries.findIndex(c => c.iso_3166_1 === country.iso_3166_1);
        if (index > -1) {
            this.state.selectedCountries.splice(index, 1);
        } else {
            this.state.selectedCountries.push(country);
        }
        this.updateContinueButton();
        this.renderCountries();
    }

    toggleService(service) {
        const index = this.state.selectedServices.findIndex(s => s.provider_id === service.provider_id);
        if (index > -1) {
            this.state.selectedServices.splice(index, 1);
        } else {
            this.state.selectedServices.push(service);
        }
        this.updateSaveButton();
        this.renderServices();
    }

    updateContinueButton() {
        const btn = document.getElementById('continue-to-services');
        btn.disabled = this.state.selectedCountries.length === 0;
    }

    updateSaveButton() {
        const btn = document.getElementById('save-config');
        btn.disabled = this.state.selectedServices.length === 0;
    }

    saveConfiguration() {
        // Check if configuration has changed
        const configChanged = this.hasConfigurationChanged();

        if (configChanged) {
            // Clear streaming data cache since countries/services changed
            this.cache.streamingData = {};
            this.saveCacheToStorage();

            // Clear current results
            this.state.movies = [];
            this.state.filteredMovies = [];

            // If on results page, automatically trigger new search
            if (this.state.currentPage === 'results') {
                this.closeModal();
                this.updateUI();
                // Trigger new search with updated configuration
                this.searchMovies();
            } else {
                this.closeModal();
                this.updateUI();
            }
        } else {
            this.closeModal();
            this.updateUI();
        }
    }

    hasConfigurationChanged() {
        if (!this.previousConfig) return false;

        // Check if countries changed
        const countriesChanged =
            this.state.selectedCountries.length !== this.previousConfig.countries.length ||
            !this.state.selectedCountries.every((c, i) =>
                c.iso_3166_1 === this.previousConfig.countries[i]?.iso_3166_1
            );

        // Check if services changed
        const servicesChanged =
            this.state.selectedServices.length !== this.previousConfig.services.length ||
            !this.state.selectedServices.every((s, i) =>
                s.provider_id === this.previousConfig.services[i]?.provider_id
            );

        return countriesChanged || servicesChanged;
    }

    cancelSearch() {
        this.searchState.shouldCancel = true;
    }

    updateProgress() {
        const percent = this.searchState.totalMovies > 0
            ? Math.round((this.searchState.processedMovies / this.searchState.totalMovies) * 100)
            : 0;

        document.getElementById('progress-text').textContent =
            `Processing ${this.searchState.processedMovies} of ${this.searchState.totalMovies} movies...`;
        document.getElementById('found-text').textContent =
            `Found: ${this.searchState.foundMovies}`;
        document.getElementById('progress-fill').style.width = `${percent}%`;
    }

    async searchMovies() {
        // Reset search state
        this.searchState = {
            isSearching: true,
            shouldCancel: false,
            totalMovies: 0,
            processedMovies: 0,
            foundMovies: 0
        };

        this.goToResultsPage();
        this.state.movies = [];
        this.state.filteredMovies = [];

        // Clear movies grid and show loading
        document.getElementById('movies-grid').innerHTML = '';
        document.getElementById('loading').classList.remove('hidden');
        document.getElementById('loading-text').textContent = 'Checking cache...';
        document.getElementById('progress-container').classList.add('hidden');

        try {
            await this.fetchGenres();

            // Check if we have cached watchlist
            const cachedWatchlist = this.getCachedWatchlist();
            let allWatchlistMovies = [];

            if (cachedWatchlist) {
                allWatchlistMovies = cachedWatchlist;
                document.getElementById('loading-text').textContent = 'Found cached watchlist! Loading streaming data...';
            } else {
                // Fetch all watchlist pages
                document.getElementById('loading-text').textContent = 'Fetching your watchlist...';
                let page = 1;
                let hasMore = true;

                while (hasMore && !this.searchState.shouldCancel) {
                    const response = await this.throttleRequest(() =>
                        fetch(
                            `https://api.themoviedb.org/3/account/${this.state.accountId}/watchlist/movies?language=en-US&page=${page}&sort_by=created_at.asc&session_id=${this.state.sessionId}`,
                            { headers: { 'Authorization': `Bearer ${this.state.apiKey}` } }
                        )
                    );
                    const data = await response.json();

                    if (data.results && data.results.length > 0) {
                        allWatchlistMovies = [...allWatchlistMovies, ...data.results];
                        page++;
                    } else {
                        hasMore = false;
                    }
                }

                // Cache the watchlist
                if (allWatchlistMovies.length > 0) {
                    this.setCachedWatchlist(allWatchlistMovies);
                }
            }

            if (this.searchState.shouldCancel) {
                this.hideLoading();
                return;
            }

            // Initialize progress tracking
            this.searchState.totalMovies = allWatchlistMovies.length;
            document.getElementById('loading-text').textContent = 'Processing movies...';
            document.getElementById('progress-container').classList.remove('hidden');
            this.updateProgress();

            // Process movies in batches of 15
            const BATCH_SIZE = 15;
            const allResults = [];

            for (let i = 0; i < allWatchlistMovies.length; i += BATCH_SIZE) {
                if (this.searchState.shouldCancel) {
                    break;
                }

                const batch = allWatchlistMovies.slice(i, i + BATCH_SIZE);

                // Process batch with caching
                const moviesWithStreaming = await Promise.all(
                    batch.map(async (movie) => {
                        const streamingData = await this.fetchStreamingInfoCached(movie.id);
                        this.searchState.processedMovies++;
                        this.updateProgress();
                        return { ...movie, streaming_availability: streamingData };
                    })
                );

                // Filter movies that have streaming availability
                const matched = moviesWithStreaming.filter(m =>
                    Object.keys(m.streaming_availability).length > 0
                );

                allResults.push(...matched);
                this.searchState.foundMovies = allResults.length;
                this.updateProgress();

                // Update UI with current results (progressive display)
                this.state.movies = allResults;
                this.renderGenreFilters();
                this.renderServiceFilters();
                this.applyFiltersAndSort();
            }

            this.hideLoading();
            this.searchState.isSearching = false;

            if (this.searchState.shouldCancel) {
                document.getElementById('loading-text').textContent = 'Search cancelled';
            }
        } catch (error) {
            console.error('Error fetching movies:', error);
            this.showError('movies-grid', 'Error loading movies. Please try again.');
            this.hideLoading();
            this.searchState.isSearching = false;
        }
    }

    async fetchStreamingInfoCached(movieId) {
        // Check cache first
        const cached = this.getCachedStreamingInfo(movieId);
        if (cached !== null) {
            return cached;
        }

        // Fetch fresh data
        const data = await this.fetchStreamingInfo(movieId);

        // Cache the result
        this.setCachedStreamingInfo(movieId, data);

        return data;
    }

    async fetchStreamingInfo(movieId) {
        try {
            const response = await this.throttleRequest(() =>
                fetch(
                    `https://api.themoviedb.org/3/movie/${movieId}/watch/providers`,
                    { headers: { 'Authorization': `Bearer ${this.state.apiKey}` } }
                )
            );
            const data = await response.json();
            const matches = {};

            this.state.selectedCountries.forEach(country => {
                const countryCode = country.iso_3166_1;
                const countryData = data.results?.[countryCode];

                if (countryData?.flatrate) {
                    const serviceMatches = countryData.flatrate.filter(service =>
                        this.state.selectedServices.some(s => s.provider_id === service.provider_id)
                    );

                    if (serviceMatches.length > 0) {
                        matches[countryCode] = {
                            link: countryData.link,
                            services: serviceMatches,
                            countryName: country.english_name
                        };
                    }
                }
            });

            return matches;
        } catch (error) {
            console.error('Error fetching streaming info:', error);
            return {};
        }
    }

    showLoading(containerId) {
        const container = document.getElementById(containerId);
        container.innerHTML = `
            <div class="loading-spinner"></div>
            <p style="text-align: center; margin-top: 16px; color: var(--color-text-secondary);">Loading...</p>
        `;
    }

    hideLoading() {
        document.getElementById('loading').classList.add('hidden');
    }

    showError(containerId, message) {
        const container = document.getElementById(containerId);
        container.innerHTML = `
            <div class="error-message" style="text-align: center; padding: 32px; color: var(--color-error);">
                <p>${message}</p>
            </div>
        `;
    }

    goToHomePage() {
        document.getElementById('home-page').classList.add('active');
        document.getElementById('results-page').classList.remove('active');
        this.state.currentPage = 'home';
    }

    goToResultsPage() {
        document.getElementById('home-page').classList.remove('active');
        document.getElementById('results-page').classList.add('active');
        this.state.currentPage = 'results';
        document.getElementById('loading').classList.remove('hidden');
    }

    renderGenreFilters() {
        const container = document.getElementById('filter-genre-list');
        container.innerHTML = '';

        const uniqueGenres = new Set();
        this.state.movies.forEach(movie => {
            movie.genre_ids.forEach(genreId => {
                if (this.data.genres[genreId]) {
                    uniqueGenres.add(JSON.stringify({id: genreId, name: this.data.genres[genreId]}));
                }
            });
        });

        const genres = Array.from(uniqueGenres).map(g => JSON.parse(g)).sort((a, b) => a.name.localeCompare(b.name));

        genres.forEach(genre => {
            const item = document.createElement('div');
            item.className = 'checkbox-item';
            const isSelected = this.state.filters.genres.includes(genre.id);
            if (isSelected) {
                item.classList.add('selected');
            }

            item.innerHTML = `
                <input type="checkbox" id="genre-${genre.id}" ${isSelected ? 'checked' : ''}>
                <label for="genre-${genre.id}">${genre.name}</label>
            `;

            item.addEventListener('click', (e) => {
                if (e.target.type !== 'checkbox') {
                    const checkbox = item.querySelector('input[type="checkbox"]');
                    checkbox.checked = !checkbox.checked;
                }
                this.toggleGenreFilter(genre.id);
            });

            container.appendChild(item);
        });
    }

    renderServiceFilters() {
        const container = document.getElementById('filter-service-list');
        container.innerHTML = '';

        this.state.selectedServices.forEach(service => {
            const item = document.createElement('div');
            item.className = 'checkbox-item';
            const isSelected = this.state.filters.services.includes(service.provider_id);
            if (isSelected) {
                item.classList.add('selected');
            }

            item.innerHTML = `
                <input type="checkbox" id="service-filter-${service.provider_id}" ${isSelected ? 'checked' : ''}>
                <label for="service-filter-${service.provider_id}">
                    <img src="https://image.tmdb.org/t/p/original${service.logo_path}"
                         alt="${service.provider_name}"
                         class="service-logo"
                         style="width: 24px; height: 24px; border-radius: 4px; margin-right: 8px; vertical-align: middle;">
                    ${service.provider_name}
                </label>
            `;

            item.addEventListener('click', (e) => {
                if (e.target.type !== 'checkbox') {
                    const checkbox = item.querySelector('input[type="checkbox"]');
                    checkbox.checked = !checkbox.checked;
                }
                this.toggleServiceFilter(service.provider_id);
            });

            container.appendChild(item);
        });
    }

    toggleGenreFilter(genreId) {
        const index = this.state.filters.genres.indexOf(genreId);
        if (index > -1) {
            this.state.filters.genres.splice(index, 1);
        } else {
            this.state.filters.genres.push(genreId);
        }
        this.renderGenreFilters();
        this.applyFiltersAndSort();
    }

    toggleServiceFilter(serviceId) {
        const index = this.state.filters.services.indexOf(serviceId);
        if (index > -1) {
            this.state.filters.services.splice(index, 1);
        } else {
            this.state.filters.services.push(serviceId);
        }
        this.renderServiceFilters();
        this.applyFiltersAndSort();
    }

    toggleFilters() {
        const panel = document.getElementById('filters-panel');
        panel.classList.toggle('hidden');
    }

    applyFiltersAndSort() {
        let filtered = [...this.state.movies];

        // Apply year range filter
        filtered = filtered.filter(movie => {
            const year = new Date(movie.release_date).getFullYear();
            return year >= this.state.filters.yearMin && year <= this.state.filters.yearMax;
        });

        // Apply rating range filter
        filtered = filtered.filter(movie =>
            movie.vote_average >= this.state.filters.ratingMin &&
            movie.vote_average <= this.state.filters.ratingMax
        );

        // Apply genre filter (OR condition)
        if (this.state.filters.genres.length > 0) {
            filtered = filtered.filter(movie => {
                return movie.genre_ids.some(genreId =>
                    this.state.filters.genres.includes(genreId)
                );
            });
        }

        // Apply service filter (OR condition)
        if (this.state.filters.services.length > 0) {
            filtered = filtered.filter(movie => {
                return Object.values(movie.streaming_availability).some(data => {
                    return data.services.some(service =>
                        this.state.filters.services.includes(service.provider_id)
                    );
                });
            });
        }

        // Apply sorting
        this.sortMovies(filtered);

        this.state.filteredMovies = filtered;
        this.renderMovies();
    }

    sortMovies(movies) {
        switch (this.state.currentSort) {
            case 'year':
                movies.sort((a, b) => new Date(b.release_date) - new Date(a.release_date));
                break;
            case 'rating':
                movies.sort((a, b) => b.vote_average - a.vote_average);
                break;
            case 'popularity':
                movies.sort((a, b) => b.popularity - a.popularity);
                break;
            case 'title':
                movies.sort((a, b) => a.title.localeCompare(b.title));
                break;
            default: // relevance
                movies.sort((a, b) => {
                    const aRel = a.vote_average * new Date(a.release_date).getFullYear();
                    const bRel = b.vote_average * new Date(b.release_date).getFullYear();
                    return bRel - aRel;
                });
        }
    }

    renderMovies() {
        const container = document.getElementById('movies-grid');
        const movieCount = document.getElementById('movie-count');

        if (this.state.filteredMovies.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <h3>No movies found</h3>
                    <p>Try adjusting your filters or selecting different countries and services.</p>
                </div>
            `;
            movieCount.textContent = '0';
            return;
        }

        container.innerHTML = '';
        movieCount.textContent = this.state.filteredMovies.length;

        this.state.filteredMovies.forEach(movie => {
            const movieCard = this.createMovieCard(movie);
            container.appendChild(movieCard);
        });
    }

    createMovieCard(movie) {
        const card = document.createElement('div');
        card.className = 'movie-card';

        const year = new Date(movie.release_date).getFullYear();
        const genres = movie.genre_ids.map(id => this.data.genres[id]).filter(Boolean).slice(0, 3);

        const genresHtml = genres.map(genreName => {
            const colors = this.getGenreColor(genreName);
            return `<span class="genre-tag" style="background: ${colors.bg}; color: ${colors.text}; border: 1px solid ${colors.border};">${genreName}</span>`;
        }).join('');

        const streamingHtml = Object.entries(movie.streaming_availability).map(([countryCode, data]) => {
            const services = data.services.map(service => {
                return `<a href="${data.link}" target="_blank" rel="noopener noreferrer" class="service-icon-link" title="${service.provider_name}">
                            <img src="https://image.tmdb.org/t/p/original${service.logo_path}"
                                alt="${service.provider_name}"
                                class="service-icon">
                        </a>`;
            }).join('');

            return `
                <div class="streaming-country">
                    <a href="${data.link}" target="_blank" rel="noopener noreferrer" class="country-link" style="color: var(--color-primary); text-decoration: none; font-weight: 500;">
                        ${data.countryName}
                    </a>
                    <div class="streaming-services">${services}</div>
                </div>
            `;
        }).join('');

        card.innerHTML = `
            <div class="movie-poster">
                <img src="https://image.tmdb.org/t/p/w400${movie.poster_path}"
                     alt="${movie.title}">
            </div>
            <div class="movie-info">
                <h3 class="movie-title">
                    <a href="https://www.themoviedb.org/movie/${movie.id}" target="_blank" rel="noopener noreferrer" class="movie-title-link">
                        ${movie.title}
                    </a>
                </h3>
                <div class="movie-meta">
                    <span class="movie-year">${year}</span>
                </div>
                ${genresHtml ? `<div class="movie-genres">${genresHtml}</div>` : ''}
                <div class="movie-rating">
                    <span class="rating-badge" style="background: #fef3c7; color: #92400e; padding: 4px 12px; border-radius: 999px; font-size: 12px; font-weight: 600;">★ ${movie.vote_average.toFixed(1)}</span>
                </div>
                <div class="movie-streaming">
                    ${streamingHtml}
                </div>
            </div>
        `;

        return card;
    }
}

// Initialize the app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new MovieStreamingApp();
});