package com.streamx.app.ui

import android.app.Activity
import android.widget.Toast
import androidx.activity.compose.BackHandler
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Download
import androidx.compose.material.icons.filled.Home
import androidx.compose.material.icons.filled.Person
import androidx.compose.material.icons.filled.Search
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.navigation.NavGraph.Companion.findStartDestination
import androidx.navigation.compose.*
import com.streamx.app.ui.screens.*
import com.streamx.app.viewmodel.StreamXViewModel

@Composable
fun MainAppScreen(
    viewModel: StreamXViewModel = viewModel()
) {
    val navController = rememberNavController()
    val navBackStackEntry by navController.currentBackStackEntryAsState()
    val currentRoute = navBackStackEntry?.destination?.route ?: Screen.Home.route

    val context = LocalContext.current
    var lastBackPressTime by remember { mutableLongStateOf(0L) }

    // Custom Root BackHandler:
    // If on Search / Downloads / Me / Detail -> navigate back to Home.
    // If on Home -> Show Toast "Press back again to exit" within 2 seconds.
    BackHandler {
        if (currentRoute != Screen.Home.route) {
            viewModel.triggerHaptic()
            navController.navigate(Screen.Home.route) {
                popUpTo(navController.graph.findStartDestination().id) {
                    saveState = true
                }
                launchSingleTop = true
                restoreState = true
            }
        } else {
            val currentTime = System.currentTimeMillis()
            if (currentTime - lastBackPressTime < 2000L) {
                (context as? Activity)?.finish()
            } else {
                lastBackPressTime = currentTime
                viewModel.triggerHaptic()
                Toast.makeText(context, "Press back again to exit", Toast.LENGTH_SHORT).show()
            }
        }
    }

    val bottomNavItems = listOf(
        Screen.Home to Icons.Default.Home,
        Screen.Search to Icons.Default.Search,
        Screen.Downloads to Icons.Default.Download,
        Screen.Profile to Icons.Default.Person
    )

    Scaffold(
        containerColor = Color(0xFF060913),
        bottomBar = {
            NavigationBar(
                containerColor = Color(0xFF080D1A),
                tonalElevation = 8.dp
            ) {
                bottomNavItems.forEach { (screen, icon) ->
                    val isSelected = currentRoute == screen.route
                    NavigationBarItem(
                        selected = isSelected,
                        onClick = {
                            viewModel.triggerHaptic()
                            if (currentRoute != screen.route) {
                                navController.navigate(screen.route) {
                                    popUpTo(navController.graph.findStartDestination().id) {
                                        saveState = true
                                    }
                                    launchSingleTop = true
                                    restoreState = true
                                }
                            }
                        },
                        icon = {
                            Icon(
                                imageVector = icon,
                                contentDescription = screen.title
                            )
                        },
                        label = {
                            Text(
                                text = screen.title,
                                style = MaterialTheme.typography.labelSmall
                            )
                        },
                        colors = NavigationBarItemDefaults.colors(
                            selectedIconColor = Color.Black,
                            selectedTextColor = Color(0xFF00F0FF),
                            indicatorColor = Color(0xFF00F0FF),
                            unselectedIconColor = Color(0xFF64748B),
                            unselectedTextColor = Color(0xFF64748B)
                        )
                    )
                }
            }
        }
    ) { paddingValues ->
        NavHost(
            navController = navController,
            startDestination = Screen.Home.route,
            modifier = Modifier
                .fillMaxSize()
                .padding(paddingValues)
        ) {
            composable(Screen.Home.route) {
                HomeScreen(
                    viewModel = viewModel,
                    onNavigateToDetail = { series ->
                        viewModel.openSeriesDetail(series)
                        navController.navigate(Screen.SeriesDetail.route)
                    }
                )
            }
            composable(Screen.Search.route) {
                SearchScreen(
                    viewModel = viewModel,
                    onNavigateToDetail = { series ->
                        viewModel.openSeriesDetail(series)
                        navController.navigate(Screen.SeriesDetail.route)
                    }
                )
            }
            composable(Screen.Downloads.route) {
                DownloadScreen(viewModel = viewModel)
            }
            composable(Screen.Profile.route) {
                ProfileScreen(
                    viewModel = viewModel,
                    onPlayHistoryItem = { historyEntity ->
                        val targetSeries = viewModel.allSeries.value.find { it.id == historyEntity.seriesId }
                        if (targetSeries != null) {
                            val season = targetSeries.seasons.find { it.seasonNumber == historyEntity.seasonNum }
                            val ep = season?.episodes?.find { it.episodeNumber == historyEntity.episodeNum }
                            if (ep != null) {
                                viewModel.playEpisodeInline(targetSeries, historyEntity.seasonNum, ep)
                                navController.navigate(Screen.SeriesDetail.route)
                            }
                        }
                    }
                )
            }
            composable(Screen.SeriesDetail.route) {
                SeriesDetailScreen(
                    viewModel = viewModel,
                    onBackClick = {
                        viewModel.triggerHaptic()
                        navController.popBackStack()
                    }
                )
            }
        }
    }
}
