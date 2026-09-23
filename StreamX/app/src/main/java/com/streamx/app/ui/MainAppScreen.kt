package com.streamx.app.ui

import android.app.Activity
import android.widget.Toast
import androidx.activity.compose.BackHandler
import androidx.compose.foundation.layout.*
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material.icons.outlined.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.navigation.NavGraph.Companion.findStartDestination
import androidx.navigation.NavHostController
import androidx.navigation.compose.*
import com.streamx.app.ui.screens.*
import com.streamx.app.viewmodel.StreamXViewModel

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun MainAppScreen(
    navController: NavHostController = rememberNavController(),
    viewModel: StreamXViewModel = viewModel()
) {
    val context = LocalContext.current
    var lastBackPressedTime by remember { mutableLongStateOf(0L) }
    val currentBackStackEntry by navController.currentBackStackEntryAsState()
    val currentRoute = currentBackStackEntry?.destination?.route

    // Root BackHandler (Double-tap to exit on Home, route to Home if on other screens)
    BackHandler {
        if (currentRoute == Screen.Home.route) {
            val now = System.currentTimeMillis()
            if (now - lastBackPressedTime < 2000) {
                (context as? Activity)?.finish()
            } else {
                lastBackPressedTime = now
                viewModel.triggerHaptic()
                Toast.makeText(context, "Press back again to exit", Toast.LENGTH_SHORT).show()
            }
        } else {
            viewModel.triggerHaptic()
            navController.navigate(Screen.Home.route) {
                popUpTo(navController.graph.findStartDestination().id) {
                    saveState = true
                }
                launchSingleTop = true
                restoreState = true
            }
        }
    }

    val bottomNavItems = listOf(
        Triple(Screen.Home, Icons.Filled.Home, Icons.Outlined.Home),
        Triple(Screen.Search, Icons.Filled.Search, Icons.Outlined.Search),
        Triple(Screen.Downloads, Icons.Filled.Download, Icons.Outlined.Download),
        Triple(Screen.Me, Icons.Filled.Person, Icons.Outlined.Person)
    )

    Scaffold(
        containerColor = Color(0xFF060913),
        bottomBar = {
            NavigationBar(
                containerColor = Color(0xFF070C18),
                tonalElevation = 8.dp
            ) {
                bottomNavItems.forEach { (screen, selectedIcon, unselectedIcon) ->
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
                                imageVector = if (isSelected) selectedIcon else unselectedIcon,
                                contentDescription = screen.title
                            )
                        },
                        label = { Text(screen.title) },
                        colors = NavigationBarItemDefaults.colors(
                            selectedIconColor = Color(0xFF00F0FF),
                            selectedTextColor = Color(0xFF00F0FF),
                            indicatorColor = Color(0x3300F0FF),
                            unselectedIconColor = Color(0xFF8E99A8),
                            unselectedTextColor = Color(0xFF8E99A8)
                        )
                    )
                }
            }
        }
    ) { innerPadding ->
        NavHost(
            navController = navController,
            startDestination = Screen.Home.route,
            modifier = Modifier.padding(innerPadding)
        ) {
            composable(Screen.Home.route) {
                HomeScreen(
                    viewModel = viewModel,
                    onSeriesClick = { series ->
                        viewModel.openSeriesDetail(series)
                        navController.navigate(Screen.Detail.createRoute(series.id))
                    }
                )
            }
            composable(Screen.Search.route) {
                SearchScreen(
                    viewModel = viewModel,
                    onSeriesClick = { series ->
                        viewModel.openSeriesDetail(series)
                        navController.navigate(Screen.Detail.createRoute(series.id))
                    }
                )
            }
            composable(Screen.Downloads.route) {
                DownloadScreen(viewModel = viewModel)
            }
            composable(Screen.Me.route) {
                ProfileScreen(
                    viewModel = viewModel,
                    onSeriesClick = { seriesId ->
                        val found = viewModel.allSeries.value.find { it.id == seriesId }
                        if (found != null) {
                            viewModel.openSeriesDetail(found)
                            navController.navigate(Screen.Detail.createRoute(found.id))
                        }
                    }
                )
            }
            composable(Screen.Detail.route) { backStackEntry ->
                val seriesId = backStackEntry.arguments?.getString("seriesId")
                val series = viewModel.allSeries.value.find { it.id == seriesId }
                    ?: viewModel.selectedSeries.value

                if (series != null) {
                    SeriesDetailScreen(
                        series = series,
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
}
