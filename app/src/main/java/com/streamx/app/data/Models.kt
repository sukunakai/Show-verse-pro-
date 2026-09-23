package com.streamx.app.data

import androidx.room.Entity
import androidx.room.PrimaryKey

/**
 * Firestore Data Models for StreamX
 */
data class Series(
    val id: String = "",
    val title: String = "",
    val thumbnailUrl: String = "",
    val category: String = "Anime",
    val uploadTimestamp: Long = System.currentTimeMillis(),
    val seasons: List<Season> = emptyList()
)

data class Season(
    val seasonNumber: Int = 1,
    val seasonTitle: String = "Season 1",
    val episodes: List<Episode> = emptyList()
)

data class Episode(
    val id: String = "",
    val episodeNumber: Int = 1,
    val title: String = "",
    val videoUrl: String = "",
    val durationSeconds: Long = 0L,
    val thumbnailUrl: String = ""
)

/**
 * Room Database Entity for Watch History
 */
@Entity(tableName = "watch_history")
data class WatchHistoryEntity(
    @PrimaryKey
    val seriesId: String,
    val seriesTitle: String,
    val seriesThumbnail: String,
    val seasonNum: Int,
    val episodeNum: Int,
    val episodeTitle: String,
    val videoUrl: String,
    val timestamp: Long = System.currentTimeMillis()
)
