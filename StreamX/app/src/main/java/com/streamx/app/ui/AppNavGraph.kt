package com.streamx.app.ui

sealed class Screen(val route: String, val title: String) {
    object Home : Screen("home", "Home")
    object Search : Screen("search", "Search")
    object Downloads : Screen("downloads", "Downloads")
    object Me : Screen("me", "Me")
    object Detail : Screen("detail/{seriesId}", "Detail") {
        fun createRoute(seriesId: String) = "detail/$seriesId"
    }
}
