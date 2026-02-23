package com.crucianelli.crucitrack

import android.content.Context
import androidx.work.CoroutineWorker
import androidx.work.WorkerParameters
import androidx.work.ListenableWorker.Result
import java.text.SimpleDateFormat
import java.util.*

class SyncCallWorker(appContext: Context, workerParams: WorkerParameters) :
    CoroutineWorker(appContext, workerParams) {

    override suspend fun doWork(): Result {
        val numero = inputData.getString("numero") ?: return Result.failure()
        val tipo = inputData.getString("tipo") ?: "ENTRANTE"
        val duracion = inputData.getInt("duracion", 0)
        val dispositivoId = inputData.getString("dispositivoId") ?: "1"
        val estado = inputData.getString("estado") ?: "FINALIZADA"
        val timestamp = inputData.getLong("timestamp", System.currentTimeMillis())

        // Formateamos la fecha exacto como la espera Supabase
        val sdf = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ssXXX", Locale.US)
        val fechaIso = sdf.format(Date(timestamp))

        return try {
            // Mapeo exacto a las propiedades de CallRequest.kt
            val request = CallRequest(
                phoneNumber = numero,
                type = tipo,
                duration = duracion,
                deviceId = dispositivoId,
                status = estado,
                callDate = fechaIso
            )

            RetrofitClient.apiService.uploadCall(
                url = "${SupabaseConfig.BASE_URL}/rest/v1/llamadas",
                apiKey = SupabaseConfig.API_KEY,
                bearer = "Bearer ${SupabaseConfig.API_KEY}",
                call = request
            )

            Result.success()
        } catch (e: Exception) {
            Result.retry()
        }
    }
}
