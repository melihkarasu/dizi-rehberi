const STORAGE_KEY = 'vibe_w…hlist';
        let watchlist = [];
        let currentFilter = 'watching';
        let currentModalShow = null;
        let activeModalSeason = 1;
        let isSearching = false;

        // 1. Veri Yükleme ve Saklama
        function loadWatchlist() {
          try {
            const saved = localStorage.getItem(STORAGE_KEY);
            if (saved) {
              watchlist = JSON.parse(saved);
            } else {
              // Varsayılan ilk yapımlar (Breaking Bad)
              watchlist = [
                {
                  id: 'tt0903747',
                  title: 'Breaking Bad',
                  type: 'series',
                  imdbRating: '9.5',
                  year: '2008-2013',
                  poster: 'https://images.metahub.space/poster/small/tt0903747/img.jpg',
                  genres: ['Crime', 'Drama', 'Thriller'],
                  status: 'watching',
                  userRating: 10,
                  totalEpisodes: 62,
                  watchedEpisodes: ['s1e1', 's1e2', 's1e3'],
                  episodes: []
                }
              ];
              saveWatchlist();
            }
          } catch(e) {
            watchlist = [];
          }
        }

        function saveWatchlist() {
          try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(watchlist));
          } catch(e) {}
          updateBadgesAndStats();
        }

        // 2. IMDb Linki veya ID'si ile Ekleme
        async function addByImdbUrl() {
          const raw = document.getElementById('input-imdb-url').value.trim();
          if (!raw) return;

          // IMDb ID ayıkla (tt1234567...)
          const match = raw.match(/tt\\d{7,8}/i);
          if (!match) {
            showToast('Geçersiz IMDb linki. Lütfen içinde "tt..." olan bir link veya ID girin.');
            return;
          }

          const imdbId = match[0].toLowerCase();

          // Zaten ekli mi?
          const exists = watchlist.find(s => s.id === imdbId);
          if (exists) {
            showToast(`"${exists.title}" zaten izleme listenizde bulunuyor.`);
            openTrackerModal(exists.id);
            return;
          }

            setButtonLoading('btn-imdb-add', false, "📥 IMDb'den Çek & Ekle");

          try {
            const res = await fetch(`/api/dizi/imdb?id=${imdbId}`);
            const data = await res.json();

            if (!data.success || !data.title) {
              throw new Error('IMDb bilgisi alınamadı');
            }

            const newShow = {
              id: imdbId,
              title: data.title,
              type: data.type || 'series',
              imdbRating: data.imdbRating || '8.0',
              year: data.year || '',
              poster: data.poster || 'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?w=400&auto=format&fit=crop&q=80',
              genres: data.genres || ['Drama'],
              status: 'watching',
              userRating: 0,
              totalEpisodes: data.episodes ? data.episodes.length : (data.type === 'movie' ? 1 : 10),
              watchedEpisodes: [],
              episodes: data.episodes || []
            };

            watchlist.unshift(newShow);
            saveWatchlist();
            document.getElementById('input-imdb-url').value = '';
            showToast(`✓ "${newShow.title}" başarıyla listenize eklendi!`);
            filterWatchlist('watching');
            openTrackerModal(newShow.id);
          } catch(err) {
            showToast('IMDb yapımı eklenirken hata oluştu. ID kontrol ediniz.');
          } finally {
            setButtonLoading('btn-imdb-add', false, "📥 IMDb'den Çek & Ekle");
          }
        }

        function quickImdb(id) {
          document.getElementById('input-imdb-url').value = id;
          addByImdbUrl();
        }

        function setButtonLoading(btnId, loading, text) {
          const btn = document.getElementById(btnId);
          if (btn) {
            btn.disabled = loading;
            btn.innerHTML = loading ? `<span class="w-4 h-4 rounded-full border-2 border-slate-900 border-t-transparent animate-spin mr-1"></span> ${text}` : text;
          }
        }

        // 3. Başlıkla Dizi Arama (TVmaze API)
        async function searchShowsByName() {
          const q = document.getElementById('input-title-search').value.trim();
          if (!q) return;

          showLoading(true, `"${q}" başlığı aranıyor...`);
          isSearching = true;

          try {
            const res = await fetch(`https://api.tvmaze.com/search/shows?q=${encodeURIComponent(q)}`);
            const data = await res.json();

            document.getElementById('search-results-banner').classList.remove('hidden');

            const results = data.map(item => {
              const s = item.show;
              return {
                id: s.externals?.imdb || ('tvm_' + s.id),
                tvmazeId: s.id,
                title: s.name,
                type: 'series',
                imdbRating: s.rating?.average ? s.rating.average.toString() : '7.5',
                year: s.premiered ? s.premiered.substring(0, 4) : '',
                poster: s.image?.medium || 'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?w=400&auto=format&fit=crop&q=80',
                genres: s.genres || [],
                status: 'search_result',
                totalEpisodes: 10,
                watchedEpisodes: []
              };
            });

            renderShowCards(results, true);
          } catch(err) {
            showToast('Arama başarısız oldu.');
          } finally {
            showLoading(false);
          }
        }

        function clearSearchResults() {
          isSearching = false;
          document.getElementById('search-results-banner').classList.add('hidden');
          document.getElementById('input-title-search').value = '';
          filterWatchlist(currentFilter);
        }

        // 4. Kartları Çizme & Filtreleme
        function filterWatchlist(tab) {
          if (isSearching) {
            document.getElementById('search-results-banner').classList.add('hidden');
            isSearching = false;
          }

          currentFilter = tab;
          ['watching', 'plan', 'completed', 'all'].forEach(t => {
            const btn = document.getElementById('btn-tab-' + t);
            if (t === tab) {
              btn.className = 'px-4 py-1.5 rounded-lg text-xs font-bold bg-blue-500 text-white transition flex items-center gap-1.5 shadow';
            } else {
              btn.className = 'px-4 py-1.5 rounded-lg text-xs font-bold text-mistral-slate hover:text-white transition flex items-center gap-1.5';
            }
          });

          let filtered = watchlist;
          if (tab !== 'all') {
            filtered = watchlist.filter(s => s.status === tab);
          }

          renderShowCards(filtered, false);
        }

        function renderShowCards(list, isSearch) {
          const grid = document.getElementById('shows-grid');
          const empty = document.getElementById('empty-state');

          if (!list || list.length === 0) {
            grid.innerHTML = '';
            empty.classList.remove('hidden');
            return;
          }

          empty.classList.add('hidden');
          grid.innerHTML = list.map(show => {
            const inWatchlist = watchlist.find(w => w.id === show.id);
            const total = show.totalEpisodes || 1;
            const watched = show.watchedEpisodes ? show.watchedEpisodes.length : 0;
            const pct = Math.min(100, Math.round((watched / total) * 100));

            return `
              <div class="show-card p-4 rounded-3xl bg-white border border-mistral-hairline hover:border-blue-500/50 transition-all duration-300 shadow-xl flex flex-col justify-between group">
                <div>
                  <div class="relative w-full aspect-[2/3] rounded-2xl overflow-hidden mb-3 bg-white shadow-md">
                    <img src="${show.poster}" alt="${show.title}" class="poster-zoom w-full h-full object-cover transition-transform duration-500">
                    <div class="absolute top-2.5 right-2.5 px-2 py-0.5 rounded-lg bg-black/75 backdrop-blur-md text-amber-400 font-black text-xs font-mono flex items-center gap-1">
                      <span>★</span> ${show.imdbRating || '8.0'}
                    </div>
                    <div class="absolute top-2.5 left-2.5 px-2 py-0.5 rounded-lg bg-blue-600/80 text-white text-[10px] font-bold uppercase tracking-wider">
                      ${show.type === 'movie' ? 'Film' : 'Dizi'}
                    </div>
                  </div>

                  <h3 class="font-bold text-sm text-mistral-ink group-hover:text-blue-400 transition truncate">${show.title}</h3>
                  <div class="flex items-center gap-2 text-xs text-mistral-slate mt-0.5">
                    <span>${show.year || '2024'}</span>
                    <span>•</span>
                    <span class="truncate">${show.genres ? show.genres.slice(0, 2).join(', ') : 'Drama'}</span>
                  </div>

                  ${!isSearch ? `
                    <!-- İlerleme Çubuğu -->
                    <div class="mt-3">
                      <div class="flex justify-between text-[11px] text-mistral-slate font-mono mb-1">
                        <span>${watched}/${total} Bölüm</span>
                        <span class="text-blue-400 font-bold">%${pct}</span>
                      </div>
                      <div class="w-full h-1.5 rounded-full bg-white overflow-hidden">
                        <div class="h-full bg-white from-blue-500 to-indigo-500 rounded-full" style="width: ${pct}%;"></div>
                      </div>
                    </div>
                  ` : ''}
                </div>

                <div class="pt-3 border-t border-mistral-hairline flex items-center justify-between mt-3">
                  ${isSearch ? `
                    <button onclick="addSearchResultToWatchlist('${show.id}', '${show.title.replace(/'/g, "\\\\'")}', '${show.poster}', '${show.imdbRating}', '${show.year}')" class="w-full py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition flex items-center justify-center gap-1.5">
                      <span>+</span> İzleme Listeme Ekle
                    </button>
                  ` : `
                    <button onclick="openTrackerModal('${show.id}')" class="text-xs text-blue-400 hover:text-blue-300 font-bold transition">
                      Bölüm Takibi &rarr;
                    </button>
                    <span class="text-[11px] px-2 py-0.5 rounded-md font-semibold ${show.status === 'watching' ? 'bg-blue-500/20 text-blue-300' : (show.status === 'completed' ? 'bg-emerald-500/20 text-emerald-300' : 'bg-mistral-cream text-mistral-slate')}">
                      ${show.status === 'watching' ? 'İzleniyor' : (show.status === 'completed' ? 'Tamamlandı' : 'İzlenecek')}
                    </span>
                  `}
                </div>
              </div>
            `;
          }).join('');
        }

        function addSearchResultToWatchlist(id, title, poster, rating, year) {
          if (watchlist.find(s => s.id === id)) {
            showToast('Bu yapım zaten listenizde var.');
            return;
          }
          const item = {
            id: id,
            title: title,
            type: 'series',
            imdbRating: rating,
            year: year,
            poster: poster,
            genres: ['Drama'],
            status: 'watching',
            userRating: 0,
            totalEpisodes: 10,
            watchedEpisodes: [],
            episodes: []
          };
          watchlist.unshift(item);
          saveWatchlist();
          showToast(`✓ "${title}" izleme listenize eklendi!`);
          clearSearchResults();
        }

        // 5. Bölüm ve Sezon Takip Modalı (Tracker Modal)
        async function openTrackerModal(id) {
          const show = watchlist.find(s => s.id === id);
          if (!show) return;

          currentModalShow = show;

          document.getElementById('modal-poster-img').src = show.poster;
          document.getElementById('modal-title').innerText = show.title;
          document.getElementById('modal-genres').innerText = show.genres ? show.genres.join(', ') : '';
          document.getElementById('modal-imdb-badge').innerText = '★ ' + (show.imdbRating || '8.0');
          document.getElementById('modal-year-badge').innerText = show.year || '';
          document.getElementById('modal-type-badge').innerText = show.type === 'movie' ? 'Film' : 'Dizi';
          document.getElementById('modal-status-select').value = show.status;
          document.getElementById('modal-user-rating').value = show.userRating || 0;

          // Eğer bölümler henüz çekilmediyse arka planda tamamla
          if (!show.episodes || show.episodes.length === 0) {
            try {
              const res = await fetch(`/api/dizi/imdb?id=${show.id}`);
              const data = await res.json();
              if (data.episodes && data.episodes.length > 0) {
                show.episodes = data.episodes;
                show.totalEpisodes = data.episodes.length;
                saveWatchlist();
              }
            } catch(e) {}
          }

          renderModalSeasonsAndEpisodes();
          updateModalProgress();
          document.getElementById('tracker-modal').classList.remove('hidden');
        }

        function closeTrackerModal() {
          document.getElementById('tracker-modal').classList.add('hidden');
          currentModalShow = null;
          filterWatchlist(currentFilter);
        }

        function renderModalSeasonsAndEpisodes() {
          if (!currentModalShow) return;

          const episodes = currentModalShow.episodes || [];
          const seasonsSet = new Set(episodes.map(e => e.season).filter(Boolean));
          const seasons = Array.from(seasonsSet).sort((a,b) => a - b);

          if (seasons.length === 0) seasons.push(1);
          if (!seasons.includes(activeModalSeason)) activeModalSeason = seasons[0];

          // Sezon sekmeleri
          const tabsBox = document.getElementById('modal-seasons-tabs');
          tabsBox.innerHTML = seasons.map(sn => `
            <button onclick="switchModalSeason(${sn})" class="px-3 py-1.5 rounded-xl text-xs font-bold ${sn === activeModalSeason ? 'bg-blue-600 text-white' : 'bg-white text-mistral-slate hover:text-white'} transition">
              Sezon ${sn}
            </button>
          `).join('');

          // Seçili sezonun bölümleri
          const epListBox = document.getElementById('modal-episodes-list');
          let seasonEpisodes = episodes.filter(e => e.season === activeModalSeason);

          if (seasonEpisodes.length === 0) {
            // Placeholder 10 bölüm
            seasonEpisodes = Array.from({ length: 10 }, (_, i) => ({
              season: activeModalSeason,
              number: i + 1,
              title: `Bölüm ${i + 1}`,
              released: ''
            }));
          }

          epListBox.innerHTML = seasonEpisodes.map(ep => {
            const epCode = `s${ep.season}e${ep.number}`;
            const isWatched = (currentModalShow.watchedEpisodes || []).includes(epCode);

            return `
              <div class="episode-row p-3 rounded-xl bg-white border border-mistral-hairline flex items-center justify-between transition cursor-pointer" onclick="toggleEpisodeWatch('${epCode}')">
                <div class="flex items-center gap-3">
                  <input type="checkbox" ${isWatched ? 'checked' : ''} class="w-4 h-4 rounded bg-white border-mistral-hairline text-blue-600 focus:ring-0 cursor-pointer pointer-events-none">
                  <div>
                    <span class="font-mono text-xs text-blue-400 font-bold mr-1">S${ep.season}E${ep.number}</span>
                    <span class="text-xs font-semibold ${isWatched ? 'text-mistral-slate line-through' : 'text-mistral-ink'}">${ep.title || 'Bölüm ' + ep.number}</span>
                  </div>
                </div>
                <div class="text-[11px] text-mistral-stone font-mono">
                  ${ep.released ? ep.released.substring(0, 10) : ''}
                </div>
              </div>
            `;
          }).join('');
        }

        function switchModalSeason(sn) {
          activeModalSeason = sn;
          renderModalSeasonsAndEpisodes();
        }

        function toggleEpisodeWatch(epCode) {
          if (!currentModalShow) return;
          if (!currentModalShow.watchedEpisodes) currentModalShow.watchedEpisodes = [];

          const idx = currentModalShow.watchedEpisodes.indexOf(epCode);
          if (idx !== -1) {
            currentModalShow.watchedEpisodes.splice(idx, 1);
          } else {
            currentModalShow.watchedEpisodes.push(epCode);
          }

          saveWatchlist();
          renderModalSeasonsAndEpisodes();
          updateModalProgress();
        }

        function markCurrentSeasonWatched() {
          if (!currentModalShow) return;
          if (!currentModalShow.watchedEpisodes) currentModalShow.watchedEpisodes = [];

          const episodes = currentModalShow.episodes || [];
          const seasonEps = episodes.filter(e => e.season === activeModalSeason);
          const targets = seasonEps.length > 0 ? seasonEps : Array.from({ length: 10 }, (_, i) => ({ season: activeModalSeason, number: i + 1 }));

          targets.forEach(e => {
            const code = `s${e.season}e${e.number}`;
            if (!currentModalShow.watchedEpisodes.includes(code)) {
              currentModalShow.watchedEpisodes.push(code);
            }
          });

          saveWatchlist();
          renderModalSeasonsAndEpisodes();
          updateModalProgress();
          showToast(`✓ Sezon ${activeModalSeason} tüm bölümleri izlendi olarak işaretlendi!`);
        }

        function updateModalProgress() {
          if (!currentModalShow) return;
          const total = currentModalShow.totalEpisodes || 1;
          const watched = currentModalShow.watchedEpisodes ? currentModalShow.watchedEpisodes.length : 0;
          const pct = Math.min(100, Math.round((watched / total) * 100));

          document.getElementById('modal-progress-text').innerText = `${watched} / ${total} Bölüm (%${pct})`;
          document.getElementById('modal-progress-bar').style.width = pct + '%';

          // Eğer hepsi bittiyse otomatik "completed" öner
          if (pct === 100 && currentModalShow.status !== 'completed') {
            currentModalShow.status = 'completed';
            document.getElementById('modal-status-select').value = 'completed';
            saveWatchlist();
          }
        }

        function updateModalStatus() {
          if (!currentModalShow) return;
          currentModalShow.status = document.getElementById('modal-status-select').value;
          saveWatchlist();
          showToast('İzleme durumu güncellendi.');
        }

        function updateModalUserRating() {
          if (!currentModalShow) return;
          currentModalShow.userRating = parseInt(document.getElementById('modal-user-rating').value) || 0;
          saveWatchlist();
          showToast('Puanınız kaydedildi.');
        }

        function removeShowFromWatchlist() {
          if (!currentModalShow) return;
          if (!confirm(`"${currentModalShow.title}" yapımını izleme listenizden silmek istediğinize emin misiniz?`)) return;

          watchlist = watchlist.filter(s => s.id !== currentModalShow.id);
          saveWatchlist();
          closeTrackerModal();
          showToast('Yapım listenizden silindi.');
        }

        // 6. Sayaçlar ve İstatistikler
        function updateBadgesAndStats() {
          const watchingCount = watchlist.filter(s => s.status === 'watching').length;
          const planCount = watchlist.filter(s => s.status === 'plan').length;
          const compCount = watchlist.filter(s => s.status === 'completed').length;

          document.getElementById('count-watching').innerText = watchingCount;
          document.getElementById('count-plan').innerText = planCount;
          document.getElementById('count-completed').innerText = compCount;
          document.getElementById('count-all').innerText = watchlist.length;

          // Toplam izlenen bölüm
          let totalWatchedEps = 0;
          let totalRatings = 0;
          let ratedCount = 0;

          watchlist.forEach(s => {
            totalWatchedEps += (s.watchedEpisodes ? s.watchedEpisodes.length : 0);
            if (s.userRating > 0) {
              totalRatings += s.userRating;
              ratedCount++;
            }
          });

          document.getElementById('badge-total-episodes').innerText = totalWatchedEps;
          document.getElementById('badge-total-shows').innerText = watchlist.length;
          document.getElementById('stat-total-shows').innerText = watchlist.length;
          document.getElementById('stat-total-episodes').innerText = totalWatchedEps;

          // Ortalama süre hesabı (~45 dk / bölüm)
          const totalHours = Math.round((totalWatchedEps * 45) / 60);
          document.getElementById('stat-total-time').innerText = totalHours > 24 ? `${Math.floor(totalHours / 24)}G ${totalHours % 24}S` : `${totalHours} Saat`;

          const avgRating = ratedCount > 0 ? (totalRatings / ratedCount).toFixed(1) : '0.0';
          document.getElementById('stat-avg-rating').innerText = '⭐ ' + avgRating;
        }

        function showLoading(show, text = '') {
          const spin = document.getElementById('loading-spinner');
          const txt = document.getElementById('loading-text');
          if (show) {
            spin.classList.remove('hidden');
            if (text) txt.innerText = text;
            document.getElementById('shows-grid').innerHTML = '';
          } else {
            spin.classList.add('hidden');
          }
        }

        function showToast(msg) {
          const toast = document.getElementById('dizi-toast');
          toast.innerText = msg;
          toast.classList.remove('hidden');
          setTimeout(() => toast.classList.add('hidden'), 3500);
        }

        // Başlangıç
        document.addEventListener('DOMContentLoaded', () => {
          loadWatchlist();
          filterWatchlist('watching');
        });
