package com.streamx.app.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.History
import androidx.compose.material.icons.filled.Person
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import coil.compose.AsyncImage
import com.streamx.app.data.WatchHistoryEntity
import com.streamx.app.viewmodel.StreamXViewModel
import java.text.SimpleDateFormat
import java.util.*

@Composable
fun ProfileScreen(
    viewModel: StreamXViewModel,
    onSeriesClick: (String) -> Unit
) {
    val watchHistory by viewModel.watchHistory.collectAsState()

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(Color(0xFF060913))
            .padding(16.dp)
    ) {
        // User Profile Header Card
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(16.dp))
                .background(Color(0xFF131A2A))
                .padding(16.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Box(
                modifier = Modifier
                    .size(54.dp)
                    .clip(RoundedCornerShape(27.dp))
                    .background(Color(0xFF00F0FF)),
                contentAlignment = Alignment.Center
            ) {
                Icon(
                    imageVector = Icons.Filled.Person,
                    contentDescription = "Avatar",
                    tint = Color.Black,
                    modifier = Modifier.size(32.dp)
                )
            }
            Spacer(modifier = Modifier.width(16.dp))
            Column {
                Text(
                    text = "StreamX Member",
                    fontSize = 18.sp,
                    fontWeight = FontWeight.Bold,
                    color = Color.White
                )
                Text(
                    text = "Local Storage (Room DB) Active",
                    fontSize = 12.sp,
                    color = Color(0xFF00F0FF)
                )
            }
        }

        Spacer(modifier = Modifier.height(24.dp))

        // Watch History Header with Clear Button
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Icon(
                    imageVector = Icons.Filled.History,
                    contentDescription = "History",
                    tint = Color(0xFF00F0FF),
                    modifier = Modifier.size(20.dp)
                )
                Spacer(modifier = Modifier.width(8.dp))
                Text(
                    text = "Watch History (${watchHistory.size})",
                    fontSize = 16.sp,
                    fontWeight = FontWeight.Bold,
                    color = Color.White
                )
            }

            if (watchHistory.isNotEmpty()) {
                IconButton(
                    onClick = { viewModel.clearWatchHistory() }
                ) {
                    Icon(
                        imageVector = Icons.Filled.Delete,
                        contentDescription = "Clear History",
                        tint = Color(0xFFEF4444)
                    )
                }
            }
        }

        Spacer(modifier = Modifier.height(12.dp))

        if (watchHistory.isEmpty()) {
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .weight(1f),
                contentAlignment = Alignment.Center
            ) {
                Text(
                    text = "No watched episodes yet.\nStart watching series from Home!",
                    fontSize = 14.sp,
                    color = Color(0xFF8E99A8),
                    lineHeight = 20.sp
                )
            }
        } else {
            LazyColumn(
                modifier = Modifier
                    .fillMaxWidth()
                    .weight(1f),
                verticalArrangement = Arrangement.spacedBy(10.dp)
            ) {
                items(watchHistory, key = { it.seriesId }) { historyItem ->
                    WatchHistoryRow(
                        history = historyItem,
                        onClick = {
                            viewModel.triggerHaptic()
                            onSeriesClick(historyItem.seriesId)
                        }
                    )
                }
            }
        }
    }
}

@Composable
fun WatchHistoryRow(
    history: WatchHistoryEntity,
    onClick: () -> Unit
) {
    val dateStr = remember(history.timestamp) {
        val sdf = SimpleDateFormat("MMM d, h:mm a", Locale.getDefault())
        sdf.format(Date(history.timestamp))
    }

    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(12.dp))
            .background(Color(0xFF131A2A))
            .clickable { onClick() }
            .padding(10.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        AsyncImage(
            model = history.seriesThumbnail,
            contentDescription = history.seriesTitle,
            contentScale = ContentScale.Crop,
            modifier = Modifier
                .width(80.dp)
                .height(55.dp)
                .clip(RoundedCornerShape(8.dp))
                .background(Color.DarkGray)
        )
        Spacer(modifier = Modifier.width(12.dp))
        Column(modifier = Modifier.weight(1f)) {
            Text(
                text = history.seriesTitle,
                fontSize = 14.sp,
                fontWeight = FontWeight.Bold,
                color = Color.White,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis
            )
            Text(
                text = "Season ${history.seasonNum} • Episode ${history.episodeNum}",
                fontSize = 12.sp,
                fontWeight = FontWeight.SemiBold,
                color = Color(0xFF00F0FF)
            )
            Text(
                text = dateStr,
                fontSize = 10.sp,
                color = Color(0xFF8E99A8)
            )
        }
    }
}
