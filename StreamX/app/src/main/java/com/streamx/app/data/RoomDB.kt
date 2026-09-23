package com.streamx.app.data

import android.content.Context
import androidx.room.*
import kotlinx.coroutines.flow.Flow

@Dao
interface WatchHistoryDao {
    @Query("SELECT * FROM watch_history ORDER BY timestamp DESC")
    fun getAllWatchHistory(): Flow<List<WatchHistoryEntity>>

    @Query("SELECT * FROM watch_history WHERE seriesId = :seriesId LIMIT 1")
    suspend fun getHistoryForSeries(seriesId: String): WatchHistoryEntity?

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertOrUpdate(history: WatchHistoryEntity)

    @Delete
    suspend fun delete(history: WatchHistoryEntity)

    @Query("DELETE FROM watch_history WHERE seriesId = :seriesId")
    suspend fun deleteBySeriesId(seriesId: String)

    @Query("DELETE FROM watch_history")
    suspend fun clearAll()
}

@Database(entities = [WatchHistoryEntity::class], version = 1, exportSchema = false)
abstract class StreamXDatabase : RoomDatabase() {
    abstract fun watchHistoryDao(): WatchHistoryDao

    companion object {
        @Volatile
        private var INSTANCE: StreamXDatabase? = null

        fun getDatabase(context: Context): StreamXDatabase {
            return INSTANCE ?: synchronized(this) {
                val instance = Room.databaseBuilder(
                    context.applicationContext,
                    StreamXDatabase::class.java,
                    "streamx_database"
                ).fallbackToDestructiveMigration().build()
                INSTANCE = instance
                instance
            }
        }
    }
}
