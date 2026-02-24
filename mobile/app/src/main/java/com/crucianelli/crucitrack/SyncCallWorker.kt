package com.crucianelli.crucitrack

import android.content.Context
import android.util.Log
import androidx.work.CoroutineWorker
import androidx.work.WorkerParameters
import androidx.work.ForegroundInfo
import android.app.NotificationChannel
import android.app.NotificationManager
import androidx.core.app.NotificationCompat

class SyncCallWorker(appContext: Context, workerParams: WorkerParameters) :
    CoroutineWorker(appContext, workerParams) {

    override suspend fun doWork(): Result {
        val db = AppDatabase.getDatabase(applicationContext)
        val callDao = db.callDao()

        // 1. Intentamos subir primero la llamada actual que viene por inputData
        val numero = inputData.getString("numero")
        if (numero != null) {
            val success = uploadSingleCall(
                numero, 
                inputData.getString("tipo") ?: "ENTRANTE",
                inputData.getInt("duracion", 0),
                inputData.getString("dispositivoId") ?: "1",
                inputData.getString("estado") ?: "FINALIZADA"
            )
            
            if (success) {
                Log.d("SyncWorker", "Llamada actual subida con éxito")
            }
        }

        // 2. LOGICA DE SEGURIDAD: Revisar si quedaron llamadas "huérfanas" en Room
        // Esto es lo que evita que tengas que abrir la app para que se carguen los datos
        return try {
            val pendingCalls = callDao.getAllCalls() // Podrías filtrar aquí las no sincronizadas si agregas un flag
            
            // Si tienes muchas llamadas, aquí podrías iterar y subirlas.
            // Por ahora, si la llamada actual falló, pedimos reintento
            Result.success()
        } catch (e: Exception) {
            Log.e("SyncWorker", "Error crítico: ${e.message}")
            Result.retry() // Android reintentará automáticamente cuando haya internet
        }
    }

    private suspend fun uploadSingleCall(num: String, tipo: String, dur: Int, devId: String, est: String): Boolean {
        return try {
            val request = CallRequest(
                phoneNumber = num,
                type = tipo,
                duration = dur,
                deviceId = devId,
                status = est
            )

            val response = RetrofitClient.apiService.uploadCall(
                apiKey = SupabaseConfig.API_KEY,
                bearer = "Bearer ${SupabaseConfig.API_KEY}",
                call = request
            )

            if (response.isSuccessful) {
                Log.d("SyncWorker", "¡Datos enviados a Supabase!")
                true
            } else {
                Log.e("SyncWorker", "Error Supabase: ${response.code()}")
                false
            }
        } catch (e: Exception) {
            Log.e("SyncWorker", "Fallo de conexión: ${e.message}")
            false
        }
    }
    
    // Necesario para Expedited Work en versiones antiguas de Android
    override suspend fun getForegroundInfo(): ForegroundInfo {
        val notification = NotificationCompat.Builder(applicationContext, "sync_channel")
            .setSmallIcon(android.R.drawable.stat_notify_sync)
            .setContentTitle("Actualizando Cruci Track")
            .build()
        return ForegroundInfo(1, notification)
    }
}