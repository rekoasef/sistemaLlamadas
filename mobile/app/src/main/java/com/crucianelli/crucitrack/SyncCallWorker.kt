package com.crucianelli.crucitrack

import android.content.Context
import android.util.Log
import androidx.work.CoroutineWorker
import androidx.work.WorkerParameters
import androidx.work.ForegroundInfo
import androidx.core.app.NotificationCompat

class SyncCallWorker(appContext: Context, workerParams: WorkerParameters) :
    CoroutineWorker(appContext, workerParams) {

    override suspend fun doWork(): Result {
        // Obtenemos los datos enviados desde el CallReceiver [cite: 67]
        val numero = inputData.getString("numero") ?: return Result.failure()
        val tipo = inputData.getString("tipo")?.uppercase() ?: "ENTRANTE"
        val duracion = inputData.getInt("duracion", 0)
        // Si el ID viene vacío, ponemos uno por defecto para que la DB no lo rechace [cite: 54, 87]
        val dispositivoId = inputData.getString("dispositivoId") ?: "PUESTO_DESCONOCIDO"
        val estadoOriginal = inputData.getString("estado") ?: "PERDIDA"

        val estadoSincronizado = when (estadoOriginal.uppercase()) {
            "ATENDIDA", "DESCOLGADO", "OFFHOOK" -> "ATENDIDA"
            else -> "PERDIDA"
        }

        return try {
            val request = CallRequest(
                phoneNumber = numero,
                type = tipo,
                duration = duracion,
                deviceId = dispositivoId,
                status = estadoSincronizado
            )

            // Intentamos la subida a Supabase [cite: 69, 81]
            val response = RetrofitClient.apiService.uploadCall(
                apiKey = SupabaseConfig.API_KEY,
                bearer = "Bearer ${SupabaseConfig.API_KEY}",
                call = request
            )

            if (response.isSuccessful) {
                Log.d("CRUCI_DEBUG", "Sincronización Exitosa")
                Result.success()
            } else {
                // Si falla, pedimos reintento automático [cite: 71]
                Log.e("CRUCI_DEBUG", "Error servidor: ${response.code()}")
                Result.retry()
            }
        } catch (e: Exception) {
            Log.e("CRUCI_DEBUG", "Error de red: ${e.message}")
            Result.retry()
        }
    }

    override suspend fun getForegroundInfo(): ForegroundInfo {
        val notification = NotificationCompat.Builder(applicationContext, "sync_channel")
            .setSmallIcon(android.R.drawable.stat_notify_sync)
            .setContentTitle("Cruci Track")
            .setContentText("Subiendo registro a la nube...")
            .build()
        return ForegroundInfo(1, notification)
    }
}