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

    companion object {
        private var lastState = TelephonyManager.EXTRA_STATE_IDLE
        private var callStartTime: Long = 0
        private var isIncoming = false
        private var savedNumber: String? = null
    }

    override fun onReceive(context: Context, intent: Intent) {
        val stateStr = intent.getStringExtra(TelephonyManager.EXTRA_STATE) ?: return
        val number = intent.getStringExtra(TelephonyManager.EXTRA_INCOMING_NUMBER) ?: savedNumber

        if (number != null) savedNumber = number

        when (stateStr) {
            TelephonyManager.EXTRA_STATE_RINGING -> {
                isIncoming = true
                lastState = TelephonyManager.EXTRA_STATE_RINGING
            }
            TelephonyManager.EXTRA_STATE_OFFHOOK -> {
                // Empezó la conversación o se atendió
                callStartTime = System.currentTimeMillis()
                lastState = TelephonyManager.EXTRA_STATE_OFFHOOK
            }
            TelephonyManager.EXTRA_STATE_IDLE -> {
                if (lastState == TelephonyManager.EXTRA_STATE_OFFHOOK) {
                    // LA LLAMADA TERMINÓ (FUE ATENDIDA)
                    val duration = ((System.currentTimeMillis() - callStartTime) / 1000).toInt()
                    procesarLlamada(context, savedNumber ?: "Desconocido", duration, "ATENDIDA")
                } else if (lastState == TelephonyManager.EXTRA_STATE_RINGING) {
                    // LA LLAMADA SE CORTÓ SIN ATENDER
                    procesarLlamada(context, savedNumber ?: "Desconocido", 0, "PERDIDA")
                }
                lastState = TelephonyManager.EXTRA_STATE_IDLE
                savedNumber = null 
            }
        }
    }

    private fun procesarLlamada(context: Context, number: String, duration: Int, estado: String) {
        val timestamp = System.currentTimeMillis()
        val tipo = if (isIncoming) "ENTRANTE" else "SALIENTE"

        // 1. Guardar local con datos reales
        val db = AppDatabase.getDatabase(context)
        CoroutineScope(Dispatchers.IO).launch {
            db.callDao().insertCall(CallLogEntity(
                phoneNumber = number,
                type = tipo,
                duration = duration,
                deviceId = "1",
                timestamp = timestamp,
                status = estado
            ))
        }

        // 2. Enviar a WorkManager
        enviarACloud(context, number, tipo, duration, estado, timestamp)
    }

    private fun enviarACloud(context: Context, num: String, tipo: String, dur: Int, est: String, ts: Long) {
        val data = workDataOf(
            "numero" to num,
            "tipo" to tipo,
            "duracion" to dur,
            "dispositivoId" to "1",
            "estado" to est,
            "timestamp" to ts
        )

        val syncRequest = OneTimeWorkRequestBuilder<SyncCallWorker>()
            .setConstraints(Constraints.Builder().setRequiredNetworkType(NetworkType.CONNECTED).build())
            .setInputData(data)
            .setBackoffCriteria(BackoffPolicy.EXPONENTIAL, WorkRequest.MIN_BACKOFF_MILLIS, TimeUnit.MILLISECONDS)
            .build()

        WorkManager.getInstance(context).enqueueUniqueWork("sync_$ts", ExistingWorkPolicy.REPLACE, syncRequest)
    }
}
