package com.streamx.app.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.Search
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.streamx.app.data.Series
import com.streamx.app.viewmodel.StreamXViewModel

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SearchScreen(
    viewModel: StreamXViewModel,
    onSeriesClick: (Series) -> Unit
) {
    val searchQuery by viewModel.searchQuery.collectAsState()
    val searchResults by viewModel.searchResults.collectAsState()
    val allSeries by viewModel.allSeries.collectAsState()

    val displayList = if (searchQuery.isBlank()) allSeries else searchResults

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(Color(0xFF060913))
            .padding(16.dp)
    ) {
        // Search Input TextField
        OutlinedTextField(
            value = searchQuery,
            onValueChange = { viewModel.setSearchQuery(it) },
            placeholder = { Text("Search Anime, K-Drama, Movies...", color = Color(0xFF8E99A8)) },
            leadingIcon = {
                Icon(
                    imageVector = Icons.Filled.Search,
                    contentDescription = "Search",
                    tint = Color(0xFF00F0FF)
                )
            },
            trailingIcon = {
                if (searchQuery.isNotEmpty()) {
                    IconButton(onClick = { viewModel.setSearchQuery("") }) {
                        Icon(
                            imageVector = Icons.Filled.Close,
                            contentDescription = "Clear",
                            tint = Color.White
                        )
                    }
                }
            },
            shape = RoundedCornerShape(16.dp),
            colors = OutlinedTextFieldDefaults.colors(
                focusedContainerColor = Color(0xFF131A2A),
                unfocusedContainerColor = Color(0xFF131A2A),
                focusedBorderColor = Color(0xFF00F0FF),
                unfocusedBorderColor = Color(0x33FFFFFF),
                focusedTextColor = Color.White,
                unfocusedTextColor = Color.White
            ),
            modifier = Modifier.fillMaxWidth()
        )

        Spacer(modifier = Modifier.height(16.dp))

        Text(
            text = if (searchQuery.isBlank()) "Popular Series (${allSeries.size})" else "Found (${searchResults.size}) results",
            fontSize = 14.sp,
            color = Color(0xFF8E99A8)
        )

        Spacer(modifier = Modifier.height(8.dp))

        if (displayList.isEmpty()) {
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .weight(1f),
                contentAlignment = Alignment.Center
            ) {
                Text(
                    text = "No series matching \"$searchQuery\"",
                    fontSize = 14.sp,
                    color = Color(0xFF8E99A8)
                )
            }
        } else {
            LazyVerticalGrid(
                columns = GridCells.Fixed(3),
                contentPadding = PaddingValues(bottom = 16.dp),
                horizontalArrangement = Arrangement.spacedBy(10.dp),
                verticalArrangement = Arrangement.spacedBy(12.dp),
                modifier = Modifier.fillMaxSize()
            ) {
                items(displayList) { series ->
                    SeriesGridCard(
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
}
