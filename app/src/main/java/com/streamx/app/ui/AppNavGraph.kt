package com.streamx.app.ui

sealed class Screen(val route: String, val title: String) {
    object Home : Screen("home", "Home")
    object Search : Screen("search", "Search")
    object Downloads : Screen("downloads", "Downloads")
    object Profile : Screen("profile", "Me")
    object SeriesDetail : Screen("series_detail", "Series")
}
