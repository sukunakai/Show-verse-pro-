package com.streamx.app

import android.app.Application
import com.google.firebase.FirebaseApp
import com.streamx.app.data.StreamXDatabase

class StreamXApp : Application() {

    val database: StreamXDatabase by lazy {
        StreamXDatabase.getDatabase(this)
    }

    override fun onCreate() {
        super.onCreate()
        FirebaseApp.initializeApp(this)
    }
}
