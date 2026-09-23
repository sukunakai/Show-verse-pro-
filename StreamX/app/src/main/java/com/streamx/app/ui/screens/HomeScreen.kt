package com.streamx.app.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.grid.*
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.*
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

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun HomeScreen(
    viewModel: StreamXViewModel,
    onSeriesClick: (Series) -> Unit
) {
    val latestReleases by viewModel.latestReleases.collectAsState()
    val filteredSeries by viewModel.filteredSeries.collectAsState()
    val selectedCategory by viewModel.selectedCategory.collectAsState()
    val isLoading by viewModel.isLoading.collectAsState()

    val categories = listOf("All", "Anime", "K-Drama", "Chinese Drama", "Movies")

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(Color(0xFF060913))
            .padding(top = 16.dp)
    ) {
        // App Header Brand
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 16.dp, vertical = 8.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.SpaceBetween
        ) {
            Column {
                Text(
                    text = "StreamX",
                    fontSize = 24.sp,
                    fontWeight = FontWeight.Black,
                    color = Color(0xFF00F0FF)
                )
                Text(
                    text = "Pure Native Android Streaming",
                    fontSize = 11.sp,
                    color = Color(0xFF8E99A8)
                )
            }
        }

        // LazyVerticalGrid containing sections
        LazyVerticalGrid(
            columns = GridCells.Fixed(3),
            modifier = Modifier.fillMaxSize(),
            contentPadding = PaddingValues(bottom = 24.dp),
            horizontalArrangement = Arrangement.spacedBy(10.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            // Section 1: Top "Latest Releases" Carousel (Spanning 3 columns)
            item(span = { GridItemSpan(3) }) {
                Column(modifier = Modifier.padding(top = 8.dp)) {
                    Text(
                        text = "🔥 Latest Releases",
                        fontSize = 16.sp,
                        fontWeight = FontWeight.Bold,
                        color = Color.White,
                        modifier = Modifier.padding(horizontal = 16.dp, vertical = 6.dp)
                    )

                    LazyRow(
                        contentPadding = PaddingValues(horizontal = 16.dp),
                        horizontalArrangement = Arrangement.spacedBy(12.dp)
                    ) {
                        items(latestReleases) { series ->
                            LatestReleaseCard(
                                series = series,
                                onClick = {
                                    viewModel.triggerHaptic()
                                    onSeriesClick(series)
                                }
                            )
                        }
                    }
                }
            }

            // Section 2: FilterChips ("All", "Anime", "K-Drama", etc.) (Spanning 3 columns)
            item(span = { GridItemSpan(3) }) {
                Column(modifier = Modifier.padding(top = 16.dp)) {
                    Text(
                        text = "Categories",
                        fontSize = 15.sp,
                        fontWeight = FontWeight.Bold,
                        color = Color.White,
                        modifier = Modifier.padding(horizontal = 16.dp, vertical = 6.dp)
                    )

                    LazyRow(
                        contentPadding = PaddingValues(horizontal = 16.dp),
                        horizontalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        items(categories) { cat ->
                            val isSelected = selectedCategory.equals(cat, ignoreCase = true)
                            FilterChip(
                                selected = isSelected,
                                onClick = { viewModel.selectCategory(cat) },
                                label = { Text(cat) },
                                shape = RoundedCornerShape(20.dp),
                                colors = FilterChipDefaults.filterChipColors(
                                    selectedContainerColor = Color(0xFF00F0FF),
                                    selectedLabelColor = Color.Black,
                                    containerColor = Color(0xFF131A2A),
                                    labelColor = Color(0xFFCBD5E1)
                                )
                            )
                        }
                    }
                }
            }

            // Section 3: Header for Series Grid
            item(span = { GridItemSpan(3) }) {
                Text(
                    text = if (selectedCategory == "All") "Browse All Series" else "$selectedCategory Series",
                    fontSize = 15.sp,
                    fontWeight = FontWeight.Bold,
                    color = Color.White,
                    modifier = Modifier.padding(start = 16.dp, end = 16.dp, top = 12.dp)
                )
            }

            // Section 4: Grid of Filtered Series
            items(filteredSeries) { series ->
                SeriesGridCard(
                    series = series,
                    onClick = {
                        viewModel.triggerHaptic()
                        onSeriesClick(series)
                    },
                    modifier = Modifier.padding(horizontal = 4.dp)
                )
            }
        }
    }
}

@Composable
fun LatestReleaseCard(
    series: Series,
    onClick: () -> Unit
) {
    Box(
        modifier = Modifier
            .width(220.dp)
            .height(130.dp)
            .clip(RoundedCornerShape(16.dp))
            .background(Color(0xFF131A2A))
            .clickable { onClick() }
    ) {
        AsyncImage(
            model = series.thumbnailUrl,
            contentDescription = series.title,
            contentScale = ContentScale.Crop,
            modifier = Modifier.fillMaxSize()
        )
        // Dark gradient overlay
        Box(
            modifier = Modifier
                .fillMaxSize()
                .background(
                    Brush.verticalGradient(
                        colors = listOf(Color.Transparent, Color(0xDD000000)),
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
                text = series.title,
                fontSize = 13.sp,
                fontWeight = FontWeight.Bold,
                color = Color.White,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis
            )
            Text(
                text = series.category,
                fontSize = 10.sp,
                fontWeight = FontWeight.SemiBold,
                color = Color(0xFF00F0FF)
            )
        }
    }
}

@Composable
fun SeriesGridCard(
    series: Series,
    onClick: () -> Unit,
    modifier: Modifier = Modifier
) {
    Column(
        modifier = modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(12.dp))
            .clickable { onClick() }
            .padding(4.dp)
    ) {
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .aspectRatio(0.7f)
                .clip(RoundedCornerShape(12.dp))
                .background(Color(0xFF131A2A))
        ) {
            AsyncImage(
                model = series.thumbnailUrl,
                contentDescription = series.title,
                contentScale = ContentScale.Crop,
                modifier = Modifier.fillMaxSize()
            )
            // Category Badge
            Box(
                modifier = Modifier
                    .align(Alignment.TopEnd)
                    .padding(6.dp)
                    .clip(RoundedCornerShape(6.dp))
                    .background(Color(0xCC000000))
                    .padding(horizontal = 6.dp, vertical = 2.dp)
            ) {
                Text(
                    text = series.category,
                    fontSize = 9.sp,
                    fontWeight = FontWeight.Bold,
                    color = Color(0xFF00F0FF)
                )
            }
        }
        Spacer(modifier = Modifier.height(6.dp))
        Text(
            text = series.title,
            fontSize = 12.sp,
            fontWeight = FontWeight.SemiBold,
            color = Color.White,
            maxLines = 2,
            overflow = TextOverflow.Ellipsis,
            lineHeight = 15.sp
        )
    }
}
