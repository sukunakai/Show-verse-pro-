package com.streamx.app.viewmodel

import android.app.Application
import android.content.Context
import android.os.Build
import android.os.VibrationEffect
import android.os.Vibrator
import android.os.VibratorManager
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.google.firebase.firestore.FirebaseFirestore
import com.streamx.app.StreamXApp
import com.streamx.app.data.Episode
import com.streamx.app.data.Season
import com.streamx.app.data.Series
import com.streamx.app.data.WatchHistoryEntity
import kotlinx.coroutines.flow.*
import kotlinx.coroutines.launch

class StreamXViewModel(application: Application) : AndroidViewModel(application) {

    private val firestore = FirebaseFirestore.getInstance()
    private val watchHistoryDao = (application as StreamXApp).database.watchHistoryDao()

    // 1. All Series from Firestore
    private val _allSeries = MutableStateFlow<List<Series>>(emptyList())
    val allSeries: StateFlow<List<Series>> = _allSeries.asStateFlow()

    private val _isLoading = MutableStateFlow(true)
    val isLoading: StateFlow<Boolean> = _isLoading.asStateFlow()

    // 2. Selected Category Filter
    private val _selectedCategory = MutableStateFlow("All")
    val selectedCategory: StateFlow<String> = _selectedCategory.asStateFlow()

    // 3. Filtered Series based on Category
    val filteredSeries: StateFlow<List<Series>> = combine(_allSeries, _selectedCategory) { seriesList, category ->
        if (category == "All") {
            seriesList
        } else {
            seriesList.filter { it.category.equals(category, ignoreCase = true) }
        }
    }.stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())

    // 4. Latest Releases (Sorted by uploadTimestamp descending)
    val latestReleases: StateFlow<List<Series>> = _allSeries.map { list ->
        list.sortedByDescending { it.uploadTimestamp }.take(10)
    }.stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())

    // 5. Search Query & Results
    private val _searchQuery = MutableStateFlow("")
    val searchQuery: StateFlow<String> = _searchQuery.asStateFlow()

    val searchResults: StateFlow<List<Series>> = combine(_allSeries, _searchQuery) { list, query ->
        if (query.isBlank()) {
            emptyList()
        } else {
            list.filter {
                it.title.contains(query, ignoreCase = true) ||
                it.category.contains(query, ignoreCase = true)
            }
        }
    }.stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())

    // 6. Watch History from Room
    val watchHistory: StateFlow<List<WatchHistoryEntity>> = watchHistoryDao.getAllWatchHistory()
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())

    // 7. Active Series in Detail Screen & Current Playing Episode
    private val _selectedSeries = MutableStateFlow<Series?>(null)
    val selectedSeries: StateFlow<Series?> = _selectedSeries.asStateFlow()

    private val _activePlayingEpisode = MutableStateFlow<Episode?>(null)
    val activePlayingEpisode: StateFlow<Episode?> = _activePlayingEpisode.asStateFlow()

    private val _activeSeasonNumber = MutableStateFlow(1)
    val activeSeasonNumber: StateFlow<Int> = _activeSeasonNumber.asStateFlow()

    init {
        fetchFirestoreSeries()
    }

    fun fetchFirestoreSeries() {
        _isLoading.value = true
        firestore.collection("series")
            .addSnapshotListener { snapshot, error ->
                _isLoading.value = false
                if (error != null) {
                    // Fallback to sample data if Firestore is offline or empty
                    loadFallbackDataIfEmpty()
                    return@addSnapshotListener
                }

                if (snapshot != null && !snapshot.isEmpty) {
                    val list = mutableListOf<Series>()
                    for (doc in snapshot.documents) {
                        try {
                            val id = doc.id
                            val title = doc.getString("title") ?: "Untitled"
                            val thumbnailUrl = doc.getString("thumbnailUrl") ?: ""
                            val category = doc.getString("category") ?: "Anime"
                            val uploadTimestamp = doc.getLong("uploadTimestamp") ?: System.currentTimeMillis()

                            // Parse nested seasons
                            val seasonsList = mutableListOf<Season>()
                            val rawSeasons = doc.get("seasons") as? List<Map<String, Any>>
                            if (rawSeasons != null) {
                                for (sMap in rawSeasons) {
                                    val sNum = (sMap["seasonNumber"] as? Number)?.toInt() ?: 1
                                    val sTitle = sMap["seasonTitle"] as? String ?: "Season $sNum"
                                    val rawEpisodes = sMap["episodes"] as? List<Map<String, Any>>
                                    val epList = mutableListOf<Episode>()
                                    if (rawEpisodes != null) {
                                        for (eMap in rawEpisodes) {
                                            epList.add(
                                                Episode(
                                                    id = eMap["id"] as? String ?: "ep_${epList.size + 1}",
                                                    episodeNumber = (eMap["episodeNumber"] as? Number)?.toInt() ?: (epList.size + 1),
                                                    title = eMap["title"] as? String ?: "Episode ${epList.size + 1}",
                                                    videoUrl = eMap["videoUrl"] as? String ?: "",
                                                    durationSeconds = (eMap["durationSeconds"] as? Number)?.toLong() ?: 0L,
                                                    thumbnailUrl = eMap["thumbnailUrl"] as? String ?: thumbnailUrl
                                                )
                                            )
                                        }
                                    }
                                    seasonsList.add(Season(sNum, sTitle, epList))
                                }
                            }

                            // If no seasons object in firestore, provide default Season 1 with videoUrl field
                            if (seasonsList.isEmpty()) {
                                val singleVideoUrl = doc.getString("videoUrl") ?: ""
                                seasonsList.add(
                                    Season(
                                        seasonNumber = 1,
                                        seasonTitle = "Season 1",
                                        episodes = listOf(
                                            Episode(
                                                id = "ep_1",
                                                episodeNumber = 1,
                                                title = "Episode 1: Pilot",
                                                videoUrl = singleVideoUrl.ifBlank { "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4" },
                                                thumbnailUrl = thumbnailUrl
                                            )
                                        )
                                    )
                                )
                            }

                            list.add(Series(id, title, thumbnailUrl, category, uploadTimestamp, seasonsList))
                        } catch (e: Exception) {
                            // continue
                        }
                    }
                    _allSeries.value = list
                } else {
                    loadFallbackDataIfEmpty()
                }
            }
    }

    private fun loadFallbackDataIfEmpty() {
        if (_allSeries.value.isEmpty()) {
            _allSeries.value = listOf(
                Series(
                    id = "solo_leveling",
                    title = "Solo Leveling: Arise",
                    thumbnailUrl = "https://images.unsplash.com/photo-1578632767115-351597cf2477?auto=format&fit=crop&w=800&q=80",
                    category = "Anime",
                    uploadTimestamp = System.currentTimeMillis() - 100000,
                    seasons = listOf(
                        Season(
                            seasonNumber = 1,
                            seasonTitle = "Season 1",
                            episodes = (1..12).map { epNum ->
                                Episode(
                                    id = "sl_e$epNum",
                                    episodeNumber = epNum,
                                    title = "Episode $epNum: The Awakening",
                                    videoUrl = "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4",
                                    thumbnailUrl = "https://images.unsplash.com/photo-1578632767115-351597cf2477?auto=format&fit=crop&w=800&q=80"
                                )
                            }
                        )
                    )
                ),
                Series(
                    id = "vincenzo",
                    title = "Vincenzo Cassano",
                    thumbnailUrl = "https://images.unsplash.com/photo-1518791841217-8f162f1e1131?auto=format&fit=crop&w=800&q=80",
                    category = "K-Drama",
                    uploadTimestamp = System.currentTimeMillis() - 200000,
                    seasons = listOf(
                        Season(
                            seasonNumber = 1,
                            seasonTitle = "Season 1",
                            episodes = (1..16).map { epNum ->
                                Episode(
                                    id = "vc_e$epNum",
                                    episodeNumber = epNum,
                                    title = "Episode $epNum: Consigliere",
                                    videoUrl = "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4",
                                    thumbnailUrl = "https://images.unsplash.com/photo-1518791841217-8f162f1e1131?auto=format&fit=crop&w=800&q=80"
                                )
                            }
                        )
                    )
                ),
                Series(
                    id = "untamed",
                    title = "The Untamed",
                    thumbnailUrl = "https://images.unsplash.com/photo-1534447677768-be436bb09401?auto=format&fit=crop&w=800&q=80",
                    category = "Chinese Drama",
                    uploadTimestamp = System.currentTimeMillis() - 300000,
                    seasons = listOf(
                        Season(
                            seasonNumber = 1,
                            seasonTitle = "Season 1",
                            episodes = (1..10).map { epNum ->
                                Episode(
                                    id = "un_e$epNum",
                                    episodeNumber = epNum,
                                    title = "Episode $epNum: Lotus Pier",
                                    videoUrl = "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/TearsOfSteel.mp4",
                                    thumbnailUrl = "https://images.unsplash.com/photo-1534447677768-be436bb09401?auto=format&fit=crop&w=800&q=80"
                                )
                            }
                        )
                    )
                )
            )
        }
    }

    fun selectCategory(category: String) {
        _selectedCategory.value = category
        triggerHaptic()
    }

    fun setSearchQuery(query: String) {
        _searchQuery.value = query
    }

    fun openSeriesDetail(series: Series) {
        _selectedSeries.value = series
        _activePlayingEpisode.value = null // reset inline video so poster shows first
        _activeSeasonNumber.value = series.seasons.firstOrNull()?.seasonNumber ?: 1
        triggerHaptic()
    }

    fun selectSeason(seasonNumber: Int) {
        _activeSeasonNumber.value = seasonNumber
        triggerHaptic()
    }

    fun playEpisodeInline(series: Series, seasonNum: Int, episode: Episode) {
        _selectedSeries.value = series
        _activeSeasonNumber.value = seasonNum
        _activePlayingEpisode.value = episode
        triggerHaptic()

        // Record playback to Room DB
        viewModelScope.launch {
            watchHistoryDao.insertOrUpdate(
                WatchHistoryEntity(
                    seriesId = series.id,
                    seriesTitle = series.title,
                    seriesThumbnail = series.thumbnailUrl,
                    seasonNum = seasonNum,
                    episodeNum = episode.episodeNumber,
                    episodeTitle = episode.title,
                    videoUrl = episode.videoUrl,
                    timestamp = System.currentTimeMillis()
                )
            )
        }
    }

    fun clearWatchHistory() {
        viewModelScope.launch {
            watchHistoryDao.clearAll()
            triggerHaptic()
        }
    }

    fun triggerHaptic() {
        try {
            val context = getApplication<Application>()
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                val vibratorManager = context.getSystemService(Context.VIBRATOR_MANAGER_SERVICE) as? VibratorManager
                vibratorManager?.defaultVibrator?.vibrate(
                    VibrationEffect.createPredefined(VibrationEffect.EFFECT_CLICK)
                )
            } else {
                @Suppress("DEPRECATION")
                val vibrator = context.getSystemService(Context.VIBRATOR_SERVICE) as? Vibrator
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    vibrator?.vibrate(VibrationEffect.createOneShot(20, VibrationEffect.DEFAULT_AMPLITUDE))
                } else {
                    @Suppress("DEPRECATION")
                    vibrator?.vibrate(20)
                }
            }
        } catch (e: Exception) {}
    }
}
