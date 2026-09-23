package com.streamx.app.ui.screens

import android.net.Uri
import android.view.ViewGroup
import android.widget.FrameLayout
import androidx.annotation.OptIn
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
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
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.viewinterop.AndroidView
import androidx.media3.common.MediaItem
import androidx.media3.common.util.UnstableApi
import androidx.media3.exoplayer.ExoPlayer
import androidx.media3.ui.PlayerView
import coil.compose.AsyncImage
import com.streamx.app.viewmodel.StreamXViewModel

@OptIn(UnstableApi::class)
@Composable
fun SeriesDetailScreen(
    viewModel: StreamXViewModel,
    onBackClick: () -> Unit
) {
    val series by viewModel.selectedSeries.collectAsState()
    val playingEpisode by viewModel.activePlayingEpisode.collectAsState()
    val activeSeasonNum by viewModel.activeSeasonNumber.collectAsState()
    val watchHistory by viewModel.watchHistory.collectAsState()

    val context = LocalContext.current

    // Media3 ExoPlayer instance managed across episode changes
    val exoPlayer = remember {
        ExoPlayer.Builder(context).build().apply {
            playWhenReady = true
        }
    }

    DisposableEffect(playingEpisode) {
        if (playingEpisode != null && playingEpisode!!.videoUrl.isNotBlank()) {
            val mediaItem = MediaItem.fromUri(Uri.parse(playingEpisode!!.videoUrl))
            exoPlayer.setMediaItem(mediaItem)
            exoPlayer.prepare()
            exoPlayer.play()
        }
        onDispose {
            // Keep player state or pause
        }
    }

    DisposableEffect(Unit) {
        onDispose {
            exoPlayer.release()
        }
    }

    if (series == null) {
        Box(
            modifier = Modifier.fillMaxSize().background(Color(0xFF060913)),
            contentAlignment = Alignment.Center
        ) {
            Text(text = "Series not found", color = Color.White)
        }
        return
    }

    val currentSeries = series!!
    val currentSeason = currentSeries.seasons.find { it.seasonNumber == activeSeasonNum }
        ?: currentSeries.seasons.firstOrNull()

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(Color(0xFF060913))
    ) {
        // --- TOP HALF: Default Poster OR YouTube-Style Inline Media3 Player (16:9) ---
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .aspectRatio(16f / 9f)
                .background(Color.Black)
        ) {
            if (playingEpisode != null) {
                // Inline ExoPlayer (No navigation to new screen)
                AndroidView(
                    factory = { ctx ->
                        PlayerView(ctx).apply {
                            player = exoPlayer
                            layoutParams = FrameLayout.LayoutParams(
                                ViewGroup.LayoutParams.MATCH_PARENT,
                                ViewGroup.LayoutParams.MATCH_PARENT
                            )
                            useController = true
                            setShowNextButton(false)
                            setShowPreviousButton(false)
                        }
                    },
                    modifier = Modifier.fillMaxSize()
                )
            } else {
                // Default Poster before playing
                AsyncImage(
                    model = currentSeries.thumbnailUrl,
                    contentDescription = currentSeries.title,
                    contentScale = ContentScale.Crop,
                    modifier = Modifier.fillMaxSize()
                )

                // Play Button Overlay on Poster
                Box(
                    modifier = Modifier
                        .fillMaxSize()
                        .background(Color.Black.copy(alpha = 0.4f)),
                    contentAlignment = Alignment.Center
                ) {
                    IconButton(
                        onClick = {
                            val firstEp = currentSeason?.episodes?.firstOrNull()
                            if (firstEp != null) {
                                viewModel.playEpisodeInline(currentSeries, currentSeason.seasonNumber, firstEp)
                            }
                        },
                        modifier = Modifier
                            .size(60.dp)
                            .background(Color(0xFF00F0FF), shape = RoundedCornerShape(30.dp))
                    ) {
                        Icon(
                            imageVector = Icons.Default.PlayArrow,
                            contentDescription = "Play",
                            tint = Color.Black,
                            modifier = Modifier.size(36.dp)
                        )
                    }
                }
            }

            // Top Bar Back Button
            IconButton(
                onClick = onBackClick,
                modifier = Modifier
                    .padding(8.dp)
                    .align(Alignment.TopStart)
                    .background(Color.Black.copy(alpha = 0.6f), shape = RoundedCornerShape(20.dp))
            ) {
                Icon(
                    imageVector = Icons.AutoMirrored.Filled.ArrowBack,
                    contentDescription = "Back",
                    tint = Color.White
                )
            }
        }

        // --- Currently Playing / Series Title Bar ---
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 16.dp, vertical = 12.dp)
        ) {
            Text(
                text = currentSeries.title,
                fontSize = 20.sp,
                fontWeight = FontWeight.Bold,
                color = Color.White
            )

            if (playingEpisode != null) {
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    modifier = Modifier.padding(top = 4.dp)
                ) {
                    Text(
                        text = "Now Playing: ",
                        fontSize = 13.sp,
                        fontWeight = FontWeight.SemiBold,
                        color = Color(0xFF00F0FF)
                    )
                    Text(
                        text = "S${activeSeasonNum}:E${playingEpisode!!.episodeNumber} - ${playingEpisode!!.title}",
                        fontSize = 13.sp,
                        color = Color(0xFFE2E8F0),
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis
                    )
                }
            } else {
                Text(
                    text = "${currentSeries.category} • ${currentSeries.seasons.size} Season(s)",
                    fontSize = 12.sp,
                    color = Color(0xFF94A3B8),
                    modifier = Modifier.padding(top = 2.dp)
                )
            }
        }

        Divider(color = Color(0xFF1E293B), thickness = 1.dp)

        // --- BOTTOM HALF: Scrollable Tabs for Seasons ---
        if (currentSeries.seasons.size > 1) {
            LazyRow(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 16.dp, vertical = 8.dp),
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                items(currentSeries.seasons) { season ->
                    val isSelected = season.seasonNumber == activeSeasonNum
                    FilterChip(
                        selected = isSelected,
                        onClick = { viewModel.selectSeason(season.seasonNumber) },
                        label = { Text(text = season.seasonTitle) },
                        colors = FilterChipDefaults.filterChipColors(
                            selectedContainerColor = Color(0xFF00F0FF),
                            selectedLabelColor = Color.Black,
                            containerColor = Color(0xFF0E1626),
                            labelColor = Color(0xFF94A3B8)
                        )
                    )
                }
            }
        }

        // --- Episode Grid of Square Boxes ("E1", "E2") ---
        val episodes = currentSeason?.episodes ?: emptyList()
        val watchedEpisodeNumbers = watchHistory
            .filter { it.seriesId == currentSeries.id && it.seasonNum == activeSeasonNum }
            .map { it.episodeNum }
            .toSet()

        Text(
            text = "Episodes (${episodes.size})",
            fontSize = 15.sp,
            fontWeight = FontWeight.Bold,
            color = Color(0xFF94A3B8),
            modifier = Modifier.padding(horizontal = 16.dp, vertical = 8.dp)
        )

        LazyVerticalGrid(
            columns = GridCells.Adaptive(minSize = 64.dp),
            contentPadding = PaddingValues(horizontal = 16.dp, vertical = 8.dp),
            horizontalArrangement = Arrangement.spacedBy(10.dp),
            verticalArrangement = Arrangement.spacedBy(10.dp),
            modifier = Modifier.fillMaxSize()
        ) {
            items(episodes, key = { it.id }) { ep ->
                val isPlaying = playingEpisode?.id == ep.id
                val isWatched = watchedEpisodeNumbers.contains(ep.episodeNumber)

                // Background tint calculation
                val backgroundColor = when {
                    isPlaying -> Color(0xFF00F0FF) // Highlight currently playing box with primary color
                    isWatched -> Color(0xFF064E3B) // Tint watched background
                    else -> Color(0xFF0E1626)
                }

                val textColor = when {
                    isPlaying -> Color.Black
                    isWatched -> Color(0xFF6EE7B7)
                    else -> Color.White
                }

                val borderColor = when {
                    isPlaying -> Color(0xFF00F0FF)
                    isWatched -> Color(0xFF10B981)
                    else -> Color(0xFF1E293B)
                }

                Box(
                    modifier = Modifier
                        .aspectRatio(1f)
                        .clip(RoundedCornerShape(8.dp))
                        .background(backgroundColor)
                        .border(1.dp, borderColor, RoundedCornerShape(8.dp))
                        .clickable {
                            viewModel.playEpisodeInline(currentSeries, currentSeason?.seasonNumber ?: 1, ep)
                        },
                    contentAlignment = Alignment.Center
                ) {
                    Column(horizontalAlignment = Alignment.CenterHorizontally) {
                        Text(
                            text = "E${ep.episodeNumber}",
                            fontSize = 15.sp,
                            fontWeight = FontWeight.ExtraBold,
                            color = textColor
                        )
                        if (isWatched && !isPlaying) {
                            Text(
                                text = "WATCHED",
                                fontSize = 8.sp,
                                fontWeight = FontWeight.Bold,
                                color = Color(0xFF34D399)
                            )
                        }
                    }
                }
            }
        }
    }
}
