package com.crucianelli.crucitrack

import android.content.Context
import android.util.Log
import androidx.work.CoroutineWorker
import androidx.work.WorkerParameters

class SyncCallWorker(appContext: Context, workerParams: WorkerParameters) :
    CoroutineWorker(appContext, workerParams) {

    override suspend fun doWork(): Result {
        val numero = inputData.getString("numero") ?: return Result.failure()
        val tipo = inputData.getString("tipo") ?: "ENTRANTE"
        val duracion = inputData.getInt("duracion", 0)
        val dispositivoId = inputData.getString("dispositivoId") ?: "1"
        val estado = inputData.getString("estado") ?: "FINALIZADA"

        return try {
            val request = CallRequest(
                phoneNumber = numero,
                type = tipo,
                duration = duracion,
                deviceId = dispositivoId,
                status = estado
            )

            Log.d("SyncWorker", "Enviando a Supabase: $numero")

            val response = RetrofitClient.apiService.uploadCall(
                apiKey = SupabaseConfig.API_KEY,
                bearer = "Bearer ${SupabaseConfig.API_KEY}",
                call = request
            )

            if (response.isSuccessful) {
                Log.d("SyncWorker", "¡Éxito total!")
                Result.success()
            } else {
                Log.e("SyncWorker", "Error Servidor: ${response.code()} - ${response.errorBody()?.string()}")
                Result.retry()
            }
        } catch (e: Exception) {
            Log.e("SyncWorker", "Fallo de red/sistema: ${e.message}")
            Result.retry()
        }
    }
}
