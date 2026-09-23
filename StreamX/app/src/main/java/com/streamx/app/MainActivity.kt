package com.streamx.app

import android.os.Build
import android.os.Bundle
import android.view.Display
import android.view.WindowManager
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.ui.graphics.Color
import com.streamx.app.ui.MainAppScreen

class MainActivity : ComponentActivity() {

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        // 1. Force Highest Screen Refresh Rate (120 Hz / 90 Hz / 144 Hz)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            try {
                @Suppress("DEPRECATION")
                val display = windowManager.defaultDisplay
                val modes = display.supportedModes
                var maxMode: Display.Mode? = null
                var maxRefreshRate = 60.0f
                for (mode in modes) {
                    if (mode.refreshRate > maxRefreshRate) {
                        maxRefreshRate = mode.refreshRate
                        maxMode = mode
                    }
                }
                if (maxMode != null) {
                    val params = window.attributes
                    params.preferredDisplayModeId = maxMode.modeId
                    window.attributes = params
                }
            } catch (ignored: Exception) {}
        }

        // 2. Window Hardware Acceleration
        try {
            window.setFlags(
                WindowManager.LayoutParams.FLAG_HARDWARE_ACCELERATED,
                WindowManager.LayoutParams.FLAG_HARDWARE_ACCELERATED
            )
        } catch (ignored: Exception) {}

        enableEdgeToEdge()

        setContent {
            val darkColorScheme = darkColorScheme(
                primary = Color(0xFF00F0FF),
                onPrimary = Color.Black,
                secondary = Color(0xFF38BDF8),
                background = Color(0xFF060913),
                surface = Color(0xFF070C18),
                onBackground = Color.White,
                onSurface = Color.White
            )

            MaterialTheme(colorScheme = darkColorScheme) {
                MainAppScreen()
            }
        }
    }
}
