package com.crucianelli.crucitrack

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.telephony.TelephonyManager
import androidx.work.*
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import java.util.concurrent.TimeUnit

class CallReceiver : BroadcastReceiver() {

    override fun onReceive(context: Context, intent: Intent) {
        val state = intent.getStringExtra(TelephonyManager.EXTRA_STATE)
        val number = intent.getStringExtra(TelephonyManager.EXTRA_INCOMING_NUMBER) ?: return

        if (state == TelephonyManager.EXTRA_STATE_IDLE) {
            val timestamp = System.currentTimeMillis()
            
            // 1. GUARDAR EN EL HISTORIAL LOCAL (Room)
            val callLog = CallLogEntity(
                phoneNumber = number,
                type = "ENTRANTE",
                duration = 0, // Aquí podrías calcular la duración real
                deviceId = "1",
                timestamp = timestamp,
                status = "PENDIENTE"
            )

            val db = AppDatabase.getDatabase(context)
            CoroutineScope(Dispatchers.IO).launch {
                db.callDao().insertCall(callLog)
            }

            // 2. ENCOLAR SUBIDA A LA NUBE (WorkManager)
            enviarLlamadaConGarantia(context, number, "ENTRANTE", 0, "1", "ATENDIDA", timestamp)
        }
    }

    private fun enviarLlamadaConGarantia(
        context: Context, 
        numero: String, 
        tipo: String, 
        duracion: Int, 
        idDisp: String, 
        estado: String,
        timestamp: Long
    ) {
        val constraints = Constraints.Builder()
            .setRequiredNetworkType(NetworkType.CONNECTED)
            .build()

        val data = workDataOf(
            "numero" to numero,
            "tipo" to tipo,
            "duracion" to duracion,
            "dispositivoId" to idDisp,
            "estado" to estado,
            "timestamp" to timestamp
        )

        val syncRequest = OneTimeWorkRequestBuilder<SyncCallWorker>()
            .setConstraints(constraints)
            .setInputData(data)
            .setBackoffCriteria(
                BackoffPolicy.EXPONENTIAL,
                WorkRequest.MIN_BACKOFF_MILLIS,
                TimeUnit.MILLISECONDS
            )
            .build()

        WorkManager.getInstance(context).enqueueUniqueWork(
            "sync_$timestamp",
            ExistingWorkPolicy.REPLACE,
            syncRequest
        )
    }
}
