package com.crucianelli.crucitrack

import android.Manifest
import android.content.Context
import android.content.pm.PackageManager
import android.util.Log
import androidx.core.content.ContextCompat
import androidx.work.*
import java.util.concurrent.TimeUnit

/**
 * HeartbeatWorker — envía un ping a Supabase cada 15 minutos.
 *
 * Estados posibles:
 *  - ONLINE        → permisos OK, app funcionando
 *  - SIN_PERMISOS  → READ_PHONE_STATE revocado por el usuario
 *  - OFFLINE       → last_seen >= 20 min (detectado por el frontend/pg_cron)
 *
 * IMPORTANTE: El worker no se programa hasta que el device_id esté configurado
 * y los permisos estén otorgados, para evitar falsos SIN_PERMISOS al instalar.
 */
class HeartbeatWorker(appContext: Context, workerParams: WorkerParameters) :
    CoroutineWorker(appContext, workerParams) {

    override suspend fun doWork(): Result {
        val prefs    = applicationContext.getSharedPreferences("Config", Context.MODE_PRIVATE)
        val deviceId = prefs.getString("device_id", "") ?: ""

        // Seguridad extra: no enviar si el ID no fue configurado aún
        if (deviceId.isBlank() || deviceId == "DESCONOCIDO") {
            Log.w("Heartbeat", "device_id no configurado, omitiendo heartbeat")
            return Result.success()
        }

        val tienePermisos = listOf(
            Manifest.permission.READ_PHONE_STATE,
            Manifest.permission.READ_CALL_LOG,
            Manifest.permission.PROCESS_OUTGOING_CALLS
        ).all { ContextCompat.checkSelfPermission(applicationContext, it) == PackageManager.PERMISSION_GRANTED }

        val status = if (tienePermisos) "ONLINE" else "SIN_PERMISOS"
        Log.d("Heartbeat", "$status — terminal $deviceId")

        return try {
            val response = RetrofitClient.apiService.sendHeartbeat(
                apiKey    = SupabaseConfig.API_KEY,
                bearer    = "Bearer ${SupabaseConfig.API_KEY}",
                heartbeat = HeartbeatRequest(terminalId = deviceId, status = status)
            )
            if (response.isSuccessful) Result.success()
            else Result.retry()
        } catch (e: Exception) {
            Log.e("Heartbeat", "Error red: ${e.message}")
            Result.retry()
        }
    }

    companion object {
        const val WORK_NAME = "crucitrack_heartbeat"

        /** Programa el heartbeat periódico cada 15 minutos. */
        fun schedule(context: Context) {
            val request = PeriodicWorkRequestBuilder<HeartbeatWorker>(10, TimeUnit.MINUTES)
                .setConstraints(
                    Constraints.Builder()
                        .setRequiredNetworkType(NetworkType.CONNECTED)
                        .build()
                )
                .build()

            WorkManager.getInstance(context).enqueueUniquePeriodicWork(
                WORK_NAME,
                ExistingPeriodicWorkPolicy.UPDATE,
                request
            )
            Log.d("Heartbeat", "Heartbeat periódico programado")
        }

        /**
         * Envía un heartbeat inmediato (one-shot).
         * Usar tras otorgar permisos o configurar el ID para corregir
         * cualquier estado incorrecto en Supabase al instante.
         */
        fun sendNow(context: Context) {
            val request = OneTimeWorkRequestBuilder<HeartbeatWorker>()
                .setExpedited(OutOfQuotaPolicy.RUN_AS_NON_EXPEDITED_WORK_REQUEST)
                .setConstraints(
                    Constraints.Builder()
                        .setRequiredNetworkType(NetworkType.CONNECTED)
                        .build()
                )
                .build()
            WorkManager.getInstance(context).enqueue(request)
            Log.d("Heartbeat", "Heartbeat inmediato encolado")
        }
    }
}
