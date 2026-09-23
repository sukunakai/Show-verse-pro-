package com.streamx.app.ui.screens

import android.view.ViewGroup
import android.widget.FrameLayout
import androidx.annotation.OptIn
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowBack
import androidx.compose.material.icons.filled.PlayArrow
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.viewinterop.AndroidView
import androidx.media3.common.MediaItem
import androidx.media3.common.util.UnstableApi
import androidx.media3.exoplayer.ExoPlayer
import androidx.media3.ui.PlayerView
import coil.compose.AsyncImage
import com.streamx.app.data.Episode
import com.streamx.app.data.Series
import com.streamx.app.viewmodel.StreamXViewModel

@OptIn(UnstableApi::class)
@Composable
fun SeriesDetailScreen(
    series: Series,
    viewModel: StreamXViewModel,
    onBackClick: () -> Unit
) {
    val context = LocalContext.current
    val activePlayingEpisode by viewModel.activePlayingEpisode.collectAsState()
    val activeSeasonNumber by viewModel.activeSeasonNumber.collectAsState()
    val watchHistory by viewModel.watchHistory.collectAsState()

    // Find currently selected season
    val currentSeason = series.seasons.find { it.seasonNumber == activeSeasonNumber }
        ?: series.seasons.firstOrNull()

    // Determine watched episodes for this series from Room
    val watchedEpisodeNumbers = remember(watchHistory, series.id, activeSeasonNumber) {
        watchHistory
            .filter { it.seriesId == series.id && it.seasonNum == activeSeasonNumber }
            .map { it.episodeNum }
            .toSet()
    }

    // Media3 ExoPlayer instance
    var exoPlayer by remember { mutableStateOf<ExoPlayer?>(null) }

    DisposableEffect(activePlayingEpisode) {
        if (activePlayingEpisode != null && activePlayingEpisode?.videoUrl?.isNotBlank() == true) {
            val player = ExoPlayer.Builder(context).build().apply {
                val mediaItem = MediaItem.fromUri(activePlayingEpisode!!.videoUrl)
                setMediaItem(mediaItem)
                prepare()
                playWhenReady = true
            }
            exoPlayer = player
        } else {
            exoPlayer?.release()
            exoPlayer = null
        }

        onDispose {
            exoPlayer?.release()
            exoPlayer = null
        }
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(Color(0xFF060913))
    ) {
        // TOP HALF: 16:9 Stage (ExoPlayer if playing, else Series Poster)
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .aspectRatio(16f / 9f)
                .background(Color.Black)
        ) {
            if (activePlayingEpisode != null && exoPlayer != null) {
                // YouTube-Style Inline Native ExoPlayer
                AndroidView(
                    factory = { ctx ->
                        PlayerView(ctx).apply {
                            this.player = exoPlayer
                            layoutParams = FrameLayout.LayoutParams(
                                ViewGroup.LayoutParams.MATCH_PARENT,
                                ViewGroup.LayoutParams.MATCH_PARENT
                            )
                            useController = true
                            setShowBuffering(PlayerView.SHOW_BUFFERING_WHEN_PLAYING)
                        }
                    },
                    modifier = Modifier.fillMaxSize()
                )
            } else {
                // Default Poster Image
                AsyncImage(
                    model = series.thumbnailUrl,
                    contentDescription = series.title,
                    contentScale = ContentScale.Crop,
                    modifier = Modifier.fillMaxSize()
                )

                // Big Centered Play Button overlay
                IconButton(
                    onClick = {
                        val firstEp = currentSeason?.episodes?.firstOrNull()
                        if (firstEp != null) {
                            viewModel.playEpisodeInline(series, activeSeasonNumber, firstEp)
                        }
                    },
                    modifier = Modifier
                        .align(Alignment.Center)
                        .size(56.dp)
                        .clip(RoundedCornerShape(28.dp))
                        .background(Color(0xCC00F0FF))
                ) {
                    Icon(
                        imageVector = Icons.Filled.PlayArrow,
                        contentDescription = "Play",
                        tint = Color.Black,
                        modifier = Modifier.size(36.dp)
                    )
                }
            }

            // Top Overlay Back Button
            IconButton(
                onClick = onBackClick,
                modifier = Modifier
                    .padding(12.dp)
                    .align(Alignment.TopStart)
                    .size(38.dp)
                    .clip(RoundedCornerShape(19.dp))
                    .background(Color(0x88000000))
            ) {
                Icon(
                    imageVector = Icons.Filled.ArrowBack,
                    contentDescription = "Back",
                    tint = Color.White
                )
            }
        }

        // Series Title & Playing Episode Status
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(16.dp)
        ) {
            Text(
                text = series.title,
                fontSize = 20.sp,
                fontWeight = FontWeight.Bold,
                color = Color.White
            )

            if (activePlayingEpisode != null) {
                Spacer(modifier = Modifier.height(4.dp))
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Box(
                        modifier = Modifier
                            .size(8.dp)
                            .clip(RoundedCornerShape(4.dp))
                            .background(Color(0xFF00F0FF))
                    )
                    Spacer(modifier = Modifier.width(6.dp))
                    Text(
                        text = "Now Playing: ${activePlayingEpisode?.title}",
                        fontSize = 13.sp,
                        fontWeight = FontWeight.SemiBold,
                        color = Color(0xFF00F0FF)
                    )
                }
            } else {
                Spacer(modifier = Modifier.height(4.dp))
                Text(
                    text = "${series.category} • ${series.seasons.size} Season(s)",
                    fontSize = 12.sp,
                    color = Color(0xFF8E99A8)
                )
            }
        }

        Divider(color = Color(0x22FFFFFF))

        // BOTTOM HALF: Scrollable Season Tabs
        if (series.seasons.isNotEmpty()) {
            ScrollableTabRow(
                selectedTabIndex = series.seasons.indexOfFirst { it.seasonNumber == activeSeasonNumber }.coerceAtLeast(0),
                containerColor = Color(0xFF070C18),
                contentColor = Color(0xFF00F0FF),
                edgePadding = 16.dp,
                divider = {}
            ) {
                series.seasons.forEach { season ->
                    Tab(
                        selected = season.seasonNumber == activeSeasonNumber,
                        onClick = { viewModel.selectSeason(season.seasonNumber) },
                        text = {
                            Text(
                                text = season.seasonTitle,
                                fontWeight = if (season.seasonNumber == activeSeasonNumber) FontWeight.Bold else FontWeight.Normal,
                                color = if (season.seasonNumber == activeSeasonNumber) Color(0xFF00F0FF) else Color(0xFF8E99A8)
                            )
                        }
                    )
                }
            }
        }

        // BOTTOM HALF: Episode Grid of Square Boxes ("E1", "E2", etc.)
        val episodes = currentSeason?.episodes ?: emptyList()

        LazyVerticalGrid(
            columns = GridCells.Fixed(5),
            contentPadding = PaddingValues(16.dp),
            horizontalArrangement = Arrangement.spacedBy(10.dp),
            verticalArrangement = Arrangement.spacedBy(10.dp),
            modifier = Modifier.fillMaxSize()
        ) {
            items(episodes) { episode ->
                val isPlaying = activePlayingEpisode?.id == episode.id
                val isWatched = watchedEpisodeNumbers.contains(episode.episodeNumber)

                EpisodeSquareBox(
                    episode = episode,
                    isPlaying = isPlaying,
                    isWatched = isWatched,
                    onClick = {
                        viewModel.playEpisodeInline(series, activeSeasonNumber, episode)
                    }
                )
            }
        }
    }
}

@Composable
fun EpisodeSquareBox(
    episode: Episode,
    isPlaying: Boolean,
    isWatched: Boolean,
    onClick: () -> Unit
) {
    // Dynamic styling based on Playing, Watched, and Default states
    val backgroundColor = when {
        isPlaying -> Color(0xFF00F0FF)
        isWatched -> Color(0xFF1E293B) // Tinted watched background
        else -> Color(0xFF131A2A)
    }

    val textColor = when {
        isPlaying -> Color.Black
        isWatched -> Color(0xFF94A3B8)
        else -> Color.White
    }

    val borderModifier = if (isPlaying) {
        Modifier.border(2.dp, Color.White, RoundedCornerShape(12.dp))
    } else if (isWatched) {
        Modifier.border(1.dp, Color(0xFF334155), RoundedCornerShape(12.dp))
    } else {
        Modifier.border(1.dp, Color(0x3300F0FF), RoundedCornerShape(12.dp))
    }

    Box(
        modifier = Modifier
            .aspectRatio(1f)
            .clip(RoundedCornerShape(12.dp))
            .background(backgroundColor)
            .then(borderModifier)
            .clickable { onClick() },
        contentAlignment = Alignment.Center
    ) {
        Column(
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.Center
        ) {
            Text(
                text = "E${episode.episodeNumber}",
                fontSize = 14.sp,
                fontWeight = FontWeight.Bold,
                color = textColor
            )
            if (isWatched && !isPlaying) {
                Text(
                    text = "Watched",
                    fontSize = 8.sp,
                    color = Color(0xFF38BDF8)
                )
            }
        }
    }
}
