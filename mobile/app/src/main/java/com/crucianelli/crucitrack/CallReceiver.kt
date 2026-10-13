package com.crucianelli.crucitrack

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.provider.CallLog
import android.telephony.TelephonyManager
import android.util.Log
import androidx.work.*
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import java.util.UUID

class CallReceiver : BroadcastReceiver() {
    
    override fun onReceive(context: Context, intent: Intent) {
        val stateStr = intent.getStringExtra(TelephonyManager.EXTRA_STATE)
        
        if (stateStr == TelephonyManager.EXTRA_STATE_IDLE) {
            // Actualiza terminal_status inmediatamente al terminar la llamada
            HeartbeatWorker.sendNow(context)

            val pendingResult = goAsync()
            CoroutineScope(Dispatchers.IO).launch {
                try {
                    // Espera necesaria para que el sistema escriba el CallLog
                    delay(3500) 
                    processCallLog(context)
                } catch (e: Exception) {
                    Log.e("CallReceiver", "Error en proceso: ${e.message}")
                } finally {
                    pendingResult.finish()
                }
            }
        }
    }

    private suspend fun processCallLog(context: Context) {
        val cursor = context.contentResolver.query(
            CallLog.Calls.CONTENT_URI,
            arrayOf(CallLog.Calls._ID, CallLog.Calls.NUMBER, CallLog.Calls.DURATION, CallLog.Calls.TYPE, CallLog.Calls.DATE),
            null,
            null,
            CallLog.Calls.DATE + " DESC"
        )

        cursor?.use {
            if (it.moveToFirst()) {
                val callId = it.getString(it.getColumnIndex(CallLog.Calls._ID))
                // NUMBER es null en llamadas de número privado
                val number = it.getString(it.getColumnIndex(CallLog.Calls.NUMBER)) ?: ""
                val duration = it.getInt(it.getColumnIndex(CallLog.Calls.DURATION))
                val typeCode = it.getInt(it.getColumnIndex(CallLog.Calls.TYPE))
                val callDate = it.getLong(it.getColumnIndex(CallLog.Calls.DATE))
                
                val prefs = context.getSharedPreferences("CallTrackerPrefs", Context.MODE_PRIVATE)
                val lastId = prefs.getString("last_call_id", "")
                
                if (callId == lastId) return
                
                prefs.edit().putString("last_call_id", callId).apply()
                
                val type = if (typeCode == CallLog.Calls.OUTGOING_TYPE) "SALIENTE" else "ENTRANTE"
                val status = if (duration >= 15) "ATENDIDA" else "RECHAZADA"

                // 1. Inserción Sincrónica en Room para asegurar persistencia antes del Worker
                saveToLocalDatabase(context, number, type, duration, status, callDate)

                // 2. Encolar Worker con prioridad máxima
                enqueueSyncWorker(context, number, type, duration, status, callDate)
            }
        }
    }

    private suspend fun saveToLocalDatabase(context: Context, num: String, type: String, dur: Int, stat: String, callDate: Long) {
        val deviceId = DeviceSettings.deviceId(context) ?: "SIN_CONFIGURAR"

        try {
            val db = AppDatabase.getDatabase(context)
            db.callDao().insertCall(CallLogEntity(
                phoneNumber = num,
                type = type,
                duration = dur,
                status = stat,
                timestamp = callDate,
                deviceId = deviceId
            ))
            Log.d("CallReceiver", "Guardado local exitoso")
        } catch (e: Exception) {
            Log.e("DB_ERROR", "Error guardando llamada: ${e.message}")
        }
    }

    private fun enqueueSyncWorker(context: Context, num: String, type: String, dur: Int, stat: String, callDate: Long) {
        val fecha = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSSXXX", Locale.US).format(Date(callDate))

        val data = Data.Builder()
            .putString("id", UUID.randomUUID().toString()) // fijo entre reintentos: el servidor no duplica
            .putString("numero", num)
            .putString("tipo", type)
            .putInt("duracion", dur)
            .putString("estado", stat)
            .putString("fecha", fecha)
            .build()

        val syncRequest = OneTimeWorkRequestBuilder<SyncCallWorker>()
            .setExpedited(OutOfQuotaPolicy.RUN_AS_NON_EXPEDITED_WORK_REQUEST) // Clave para Background real
            .setConstraints(Constraints.Builder()
                .setRequiredNetworkType(NetworkType.CONNECTED)
                .build())
            .setInputData(data)
            .build()

        WorkManager.getInstance(context).enqueueUniqueWork(
            "sync_call_${System.currentTimeMillis()}",
            ExistingWorkPolicy.REPLACE,
            syncRequest
        )
    }
}