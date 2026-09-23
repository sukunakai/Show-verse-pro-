package com.streamx.app.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.CloudDownload
import androidx.compose.material.icons.filled.DownloadDone
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.streamx.app.viewmodel.StreamXViewModel

@Composable
fun DownloadScreen(
    viewModel: StreamXViewModel
) {
    var isSimulatingDownload by remember { mutableStateOf(false) }
    var hasSampleDownloaded by remember { mutableStateOf(false) }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(Color(0xFF060913))
            .padding(16.dp),
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Text(
                text = "Offline Downloads",
                fontSize = 20.sp,
                fontWeight = FontWeight.Bold,
                color = Color.White
            )
        }

        Spacer(modifier = Modifier.height(32.dp))

        if (!hasSampleDownloaded) {
            Box(
                modifier = Modifier
                    .size(90.dp)
                    .clip(RoundedCornerShape(45.dp))
                    .background(Color(0xFF131A2A)),
                contentAlignment = Alignment.Center
            ) {
                Icon(
                    imageVector = Icons.Filled.CloudDownload,
                    contentDescription = "Downloads",
                    tint = Color(0xFF00F0FF),
                    modifier = Modifier.size(48.dp)
                )
            }

            Spacer(modifier = Modifier.height(16.dp))

            Text(
                text = "No Videos Downloaded Yet",
                fontSize = 17.sp,
                fontWeight = FontWeight.Bold,
                color = Color.White
            )

            Spacer(modifier = Modifier.height(6.dp))

            Text(
                text = "Episodes you download will appear here for 100% offline playback without internet connection.",
                fontSize = 13.sp,
                color = Color(0xFF8E99A8),
                textAlign = TextAlign.Center,
                modifier = Modifier.padding(horizontal = 24.dp)
            )

            Spacer(modifier = Modifier.height(24.dp))

            Button(
                onClick = {
                    viewModel.triggerHaptic()
                    isSimulatingDownload = true
                    hasSampleDownloaded = true
                },
                colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF00F0FF)),
                shape = RoundedCornerShape(12.dp)
            ) {
                Text(
                    text = "Test Local Download Cache",
                    color = Color.Black,
                    fontWeight = FontWeight.Bold
                )
            }
        } else {
            // Display downloaded local file card
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(14.dp))
                    .background(Color(0xFF131A2A))
                    .padding(14.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                Icon(
                    imageVector = Icons.Filled.DownloadDone,
                    contentDescription = "Downloaded",
                    tint = Color(0xFF10B981),
                    modifier = Modifier.size(32.dp)
                )
                Spacer(modifier = Modifier.width(14.dp))
                Column(modifier = Modifier.weight(1f)) {
                    Text(
                        text = "Solo Leveling • Episode 1",
                        fontSize = 14.sp,
                        fontWeight = FontWeight.Bold,
                        color = Color.White
                    )
                    Text(
                        text = "Saved in App Internal Storage • 248 MB",
                        fontSize = 11.sp,
                        color = Color(0xFF8E99A8)
                    )
                }
            }
        }
    }
}
