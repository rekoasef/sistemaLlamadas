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

class CallReceiver : BroadcastReceiver() {
    
    override fun onReceive(context: Context, intent: Intent) {
        val stateStr = intent.getStringExtra(TelephonyManager.EXTRA_STATE)
        
        // Solo procesamos cuando el teléfono vuelve a estar libre (IDLE)
        if (stateStr == TelephonyManager.EXTRA_STATE_IDLE) {
            val pendingResult = goAsync()
            CoroutineScope(Dispatchers.IO).launch {
                try {
                    // Esperamos 3 segundos para asegurar que el sistema escribió el Log completo
                    delay(3000) 
                    processCallLog(context)
                } finally {
                    pendingResult.finish()
                }
            }
        }
    }

    private fun processCallLog(context: Context) {
        val cursor = context.contentResolver.query(
            CallLog.Calls.CONTENT_URI,
            arrayOf(CallLog.Calls._ID, CallLog.Calls.NUMBER, CallLog.Calls.DURATION, CallLog.Calls.TYPE),
            null,
            null,
            CallLog.Calls.DATE + " DESC"
        )

        cursor?.use {
            if (it.moveToFirst()) {
                val callId = it.getString(it.getColumnIndex(CallLog.Calls._ID))
                val number = it.getString(it.getColumnIndex(CallLog.Calls.NUMBER))
                val duration = it.getInt(it.getColumnIndex(CallLog.Calls.DURATION))
                val typeCode = it.getInt(it.getColumnIndex(CallLog.Calls.TYPE))
                
                // --- FILTRO DE DUPLICADOS POR ID ---
                val prefs = context.getSharedPreferences("CallTrackerPrefs", Context.MODE_PRIVATE)
                val lastId = prefs.getString("last_call_id", "")
                
                if (callId == lastId) {
                    Log.d("CallReceiver", "Llamada $callId ya procesada. Ignorando duplicado.")
                    return
                }
                
                // Guardar el nuevo ID inmediatamente
                prefs.edit().putString("last_call_id", callId).apply()
                // ------------------------------------

                val type = if (typeCode == CallLog.Calls.OUTGOING_TYPE) "SALIENTE" else "ENTRANTE"
                
                // Mantenemos tu criterio de 15 segundos
                val status = if (duration >= 15) "ATENDIDA" else "RECHAZADA"

                Log.d("CallReceiver", "Procesando nueva llamada ID: $callId | Duración: $duration s")
                saveAndSync(context, number, type, duration, status)
            }
        }
    }

    private fun saveAndSync(context: Context, num: String, type: String, dur: Int, stat: String) {
        val prefs = context.getSharedPreferences("Config", Context.MODE_PRIVATE)
        val deviceId = prefs.getString("device_id", "1") ?: "1"

        CoroutineScope(Dispatchers.IO).launch {
            try {
                val db = AppDatabase.getDatabase(context)
                db.callDao().insertCall(CallLogEntity(
                    phoneNumber = num,
                    type = type,
                    duration = dur,
                    status = stat,
                    timestamp = System.currentTimeMillis(),
                    deviceId = deviceId
                ))
            } catch (e: Exception) { Log.e("DB_ERROR", "${e.message}") }
        }

        val data = Data.Builder()
            .putString("numero", num)
            .putString("tipo", type)
            .putInt("duracion", dur)
            .putString("estado", stat)
            .putString("dispositivoId", deviceId)
            .build()

        WorkManager.getInstance(context).enqueue(
            OneTimeWorkRequestBuilder<SyncCallWorker>()
                .setConstraints(Constraints.Builder().setRequiredNetworkType(NetworkType.CONNECTED).build())
                .setInputData(data)
                .build()
        )
    }
}
