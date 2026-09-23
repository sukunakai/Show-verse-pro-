package com.streamx.app.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import coil.compose.AsyncImage
import com.streamx.app.data.Series
import com.streamx.app.viewmodel.StreamXViewModel

@Composable
fun HomeScreen(
    viewModel: StreamXViewModel,
    onNavigateToDetail: (Series) -> Unit
) {
    val latestReleases by viewModel.latestReleases.collectAsState()
    val filteredSeries by viewModel.filteredSeries.collectAsState()
    val selectedCategory by viewModel.selectedCategory.collectAsState()
    val isLoading by viewModel.isLoading.collectAsState()

    val categories = listOf("All", "Anime", "K-Drama", "C-Drama", "Action", "Romance")

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(Color(0xFF060913))
    ) {
        // App Bar Header
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 16.dp, vertical = 12.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.SpaceBetween
        ) {
            Column {
                Text(
                    text = "StreamX",
                    fontSize = 26.sp,
                    fontWeight = FontWeight.ExtraBold,
                    color = Color.White
                )
                Text(
                    text = "High Frame Rate Streaming",
                    fontSize = 11.sp,
                    color = Color(0xFF00F0FF)
                )
            }

            Surface(
                shape = RoundedCornerShape(20.dp),
                color = Color(0xFF0F172A),
                border = androidx.compose.foundation.BorderStroke(1.dp, Color(0xFF00F0FF).copy(alpha = 0.3f))
            ) {
                Text(
                    text = "120 FPS Native",
                    modifier = Modifier.padding(horizontal = 10.dp, vertical = 4.dp),
                    fontSize = 11.sp,
                    fontWeight = FontWeight.Bold,
                    color = Color(0xFF00F0FF)
                )
            }
        }

        if (isLoading && filteredSeries.isEmpty()) {
            Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                CircularProgressIndicator(color = Color(0xFF00F0FF))
            }
        } else {
            LazyVerticalGrid(
                columns = GridCells.Fixed(2),
                contentPadding = PaddingValues(16.dp),
                horizontalArrangement = Arrangement.spacedBy(12.dp),
                verticalArrangement = Arrangement.spacedBy(16.dp),
                modifier = Modifier.fillMaxSize()
            ) {
                // Section a) Top: Latest Releases (Horizontal Row)
                item(span = { androidx.compose.foundation.lazy.grid.GridItemSpan(2) }) {
                    Column(modifier = Modifier.fillMaxWidth()) {
                        Text(
                            text = "Latest Releases",
                            fontSize = 18.sp,
                            fontWeight = FontWeight.Bold,
                            color = Color.White,
                            modifier = Modifier.padding(bottom = 8.dp)
                        )
                        LazyRow(
                            horizontalArrangement = Arrangement.spacedBy(12.dp)
                        ) {
                            items(latestReleases, key = { it.id }) { series ->
                                LatestReleaseCard(
                                    series = series,
                                    onClick = {
                                        viewModel.triggerHaptic()
                                        onNavigateToDetail(series)
                                    }
                                )
                            }
                        }
                    }
                }

                // Section b) Middle: FilterChips Row
                item(span = { androidx.compose.foundation.lazy.grid.GridItemSpan(2) }) {
                    Column(modifier = Modifier.fillMaxWidth().padding(top = 12.dp, bottom = 4.dp)) {
                        Text(
                            text = "Explore Categories",
                            fontSize = 16.sp,
                            fontWeight = FontWeight.Bold,
                            color = Color(0xFF94A3B8),
                            modifier = Modifier.padding(bottom = 8.dp)
                        )
                        LazyRow(
                            horizontalArrangement = Arrangement.spacedBy(8.dp)
                        ) {
                            items(categories) { category ->
                                val isSelected = selectedCategory.equals(category, ignoreCase = true)
                                FilterChip(
                                    selected = isSelected,
                                    onClick = { viewModel.selectCategory(category) },
                                    label = {
                                        Text(
                                            text = category,
                                            fontWeight = if (isSelected) FontWeight.Bold else FontWeight.Normal
                                        )
                                    },
                                    colors = FilterChipDefaults.filterChipColors(
                                        selectedContainerColor = Color(0xFF00F0FF),
                                        selectedLabelColor = Color.Black,
                                        containerColor = Color(0xFF0E1626),
                                        labelColor = Color(0xFFCBD5E1)
                                    ),
                                    border = androidx.compose.foundation.BorderStroke(
                                        1.dp,
                                        if (isSelected) Color(0xFF00F0FF) else Color(0xFF1E293B)
                                    )
                                )
                            }
                        }
                    }
                }

                // Section c) Bottom: LazyVerticalGrid of Series
                items(filteredSeries, key = { it.id }) { series ->
                    SeriesGridCard(
                        series = series,
                        onClick = {
                            viewModel.triggerHaptic()
                            onNavigateToDetail(series)
                        }
                    )
                }
            }
        }
    }
}

@Composable
fun LatestReleaseCard(series: Series, onClick: () -> Unit) {
    Card(
        modifier = Modifier
            .width(220.dp)
            .height(130.dp)
            .clickable(onClick = onClick),
        shape = RoundedCornerShape(12.dp),
        colors = CardDefaults.cardColors(containerColor = Color(0xFF0D1527))
    ) {
        Box(modifier = Modifier.fillMaxSize()) {
            AsyncImage(
                model = series.thumbnailUrl,
                contentDescription = series.title,
                contentScale = ContentScale.Crop,
                modifier = Modifier.fillMaxSize()
            )
            Box(
                modifier = Modifier
                    .fillMaxSize()
                    .background(
                        Brush.verticalGradient(
                            colors = listOf(Color.Transparent, Color.Black.copy(alpha = 0.85f)),
                            startY = 60f
                        )
                    )
            )
            Column(
                modifier = Modifier
                    .align(Alignment.BottomStart)
                    .padding(10.dp)
            ) {
                Text(
                    text = series.category.uppercase(),
                    color = Color(0xFF00F0FF),
                    fontSize = 9.sp,
                    fontWeight = FontWeight.Bold
                )
                Text(
                    text = series.title,
                    color = Color.White,
                    fontSize = 13.sp,
                    fontWeight = FontWeight.Bold,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis
                )
            }
        }
    }
}

@Composable
fun SeriesGridCard(series: Series, onClick: () -> Unit) {
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .clickable(onClick = onClick)
    ) {
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .aspectRatio(0.72f)
                .clip(RoundedCornerShape(10.dp))
                .background(Color(0xFF0E1626))
        ) {
            AsyncImage(
                model = series.thumbnailUrl,
                contentDescription = series.title,
                contentScale = ContentScale.Crop,
                modifier = Modifier.fillMaxSize()
            )
            Surface(
                modifier = Modifier
                    .align(Alignment.TopEnd)
                    .padding(6.dp),
                shape = RoundedCornerShape(6.dp),
                color = Color.Black.copy(alpha = 0.7f)
            ) {
                Text(
                    text = series.category,
                    color = Color(0xFF00F0FF),
                    fontSize = 9.sp,
                    fontWeight = FontWeight.SemiBold,
                    modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp)
                )
            }
        }

        Spacer(modifier = Modifier.height(6.dp))
        Text(
            text = series.title,
            color = Color.White,
            fontSize = 13.sp,
            fontWeight = FontWeight.SemiBold,
            maxLines = 1,
            overflow = TextOverflow.Ellipsis
        )
        Text(
            text = "${series.seasons.size} Season${if (series.seasons.size > 1) "s" else ""}",
            color = Color(0xFF64748B),
            fontSize = 11.sp
        )
    }
}
