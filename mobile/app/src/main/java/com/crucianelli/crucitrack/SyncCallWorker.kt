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
        // Datos enviados desde el CallReceiver
        val id = inputData.getString("id") ?: return Result.failure()
        val numero = inputData.getString("numero") ?: return Result.failure()
        val fecha = inputData.getString("fecha") ?: return Result.failure()
        val tipo = inputData.getString("tipo")?.uppercase() ?: "ENTRANTE"
        val duracion = inputData.getInt("duracion", 0)
        val estadoOriginal = inputData.getString("estado") ?: "PERDIDA"

        val estadoSincronizado = when (estadoOriginal.uppercase()) {
            "ATENDIDA", "DESCOLGADO", "OFFHOOK" -> "ATENDIDA"
            else -> "PERDIDA"
        }

        // Sin token no se puede subir: queda en cola hasta que se configure.
        val auth = DeviceSettings.authHeader(applicationContext) ?: run {
            Log.w("CRUCI_DEBUG", "Sin token configurado, reintentando más tarde")
            return Result.retry()
        }

        return try {
            val request = CallRequest(
                id = id,
                phoneNumber = numero,
                type = tipo,
                duration = duracion,
                status = estadoSincronizado,
                date = fecha
            )

            val response = RetrofitClient.apiService.uploadCall(bearer = auth, call = request)

            when {
                response.isSuccessful -> {
                    Log.d("CRUCI_DEBUG", "Sincronización Exitosa")
                    Result.success()
                }
                // Datos que el servidor nunca va a aceptar: reintentar no sirve
                response.code() == 400 -> {
                    Log.e("CRUCI_DEBUG", "Llamada rechazada por el servidor (400)")
                    Result.failure()
                }
                // 401 (token inválido/revocado) y 5xx: reintento con backoff
                else -> {
                    Log.e("CRUCI_DEBUG", "Error servidor: ${response.code()}")
                    Result.retry()
                }
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
