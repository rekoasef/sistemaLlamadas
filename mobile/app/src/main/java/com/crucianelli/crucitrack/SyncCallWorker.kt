package com.crucianelli.crucitrack

import android.content.Context
import android.util.Log
import androidx.work.CoroutineWorker
import androidx.work.WorkerParameters
import androidx.work.ListenableWorker.Result
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

        return try {
            val request = CallRequest(
                phoneNumber = numero,
                type = tipo,
                duration = duracion,
                deviceId = dispositivoId,
                status = estado
                // La fecha se genera sola en CallRequest según vimos en tu código
            )

            Log.d("SyncWorker", "Intentando subir: $numero - $estado")

            val response = RetrofitClient.apiService.uploadCall(
                url = "${SupabaseConfig.BASE_URL}/rest/v1/llamadas",
                apiKey = SupabaseConfig.API_KEY,
                bearer = "Bearer ${SupabaseConfig.API_KEY}",
                call = request
            )

            // Como uploadCall devuelve Unit o Response, verificamos si no lanzó excepción
            Log.d("SyncWorker", "¡Subida exitosa a Supabase!")
            Result.success()
        } catch (e: Exception) {
            Log.e("SyncWorker", "Error al subir: ${e.message}")
            // Si el error es 404 o 400, reintentar no servirá de mucho, 
            // pero si es falta de red, WorkManager lo hará después.
            Result.retry()
        }
    }
}
